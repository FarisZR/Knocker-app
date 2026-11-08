#!/usr/bin/env python3
"""Render Play Store listing images from emulator captures.

Design language: warm near-black backdrop with a soft Knocker-yellow glow
and concentric "knock ripple" rings behind a slightly tilted device frame.
Headlines are set in Nimbus Sans Bold with one Knocker-yellow phrase per
shot, followed by a one-sentence explainer in muted prose.

Shots 1 and 3 show the app itself, so the whole device is framed and
nothing is cropped. The device's own top bar already carries the Knocker
wordmark, so no brand block is drawn. Shots 2 and 4 show the system shade;
there the screen content is zoomed in and the frame may bleed off the
bottom edge. Their callout cards tilt in the same direction as the phone
and hover where the highlighted element actually sits: on the left for the
Quick Settings tile, centered for the notification.

Requires Pillow and the URW Base 35 fonts (Nimbus Sans Bold + Regular).
Run from the repository root: python3 docs/play-store/render.py
"""
from pathlib import Path
from PIL import Image, ImageDraw, ImageFont, ImageFilter, ImageEnhance

ROOT = Path(__file__).resolve().parent
OUT = ROOT / 'screenshots'
OUT.mkdir(exist_ok=True)

W, H = 1080, 1920
YELLOW = (253, 229, 98)        # Knocker wordmark yellow, #FDE562
INK = (247, 243, 232)          # warm off-white headline
MUTED = (201, 193, 172)        # secondary prose
BG_TOP = (27, 23, 15)          # warm dark, lifted toward the glow
BG_BOT = (10, 9, 7)            # near-black at the base
GREEN = (74, 108, 82)          # faint secondary glow, echoes active grants

F_BOLD = '/usr/share/fonts/opentype/urw-base35/NimbusSans-Bold.otf'
F_REG = '/usr/share/fonts/opentype/urw-base35/NimbusSans-Regular.otf'

HEAD_TOP = 187                 # headline line centers at HEAD_TOP, +112
PROSE_TOP = 357                # prose lines at PROSE_TOP, +52


def vgrad(size, top, bottom):
    """Vertical linear gradient rendered as a 1px column, then scaled."""
    w, h = size
    column = Image.new('RGB', (1, h))
    column.putdata([
        tuple(round(a + (b - a) * y / (h - 1)) for a, b in zip(top, bottom))
        for y in range(h)
    ])
    return column.resize((w, h))


def glow(size, center, radius, color, alpha):
    """Soft radial light."""
    layer = Image.new('RGBA', size, (0, 0, 0, 0))
    cx, cy = center
    ImageDraw.Draw(layer).ellipse(
        (cx - radius, cy - radius, cx + radius, cy + radius),
        fill=color + (alpha,))
    return layer.filter(ImageFilter.GaussianBlur(radius * 0.55))


def ripples(size, center):
    """Concentric knock pulses fading outward from the device."""
    layer = Image.new('RGBA', size, (0, 0, 0, 0))
    d = ImageDraw.Draw(layer)
    cx, cy = center
    for radius, alpha in ((232, 36), (288, 28), (440, 22), (592, 16),
                          (744, 11), (896, 8), (1048, 5)):
        d.ellipse((cx - radius, cy - radius, cx + radius, cy + radius),
                  outline=YELLOW + (alpha,), width=2)
    return layer


def vignette(size, strength=0.34):
    grad = Image.radial_gradient('L').resize(size)
    mask = grad.point(lambda v: int(v * strength))
    dark = Image.new('RGBA', size, (0, 0, 0, 255))
    dark.putalpha(mask)
    return dark


def rounded_paste(canvas, img, xy, radius):
    mask = Image.new('L', img.size)
    ImageDraw.Draw(mask).rounded_rectangle(
        (0, 0, img.width - 1, img.height - 1), radius, fill=255)
    canvas.paste(img, xy, mask)


def tracked_width(draw, text, fnt, tracking):
    if not text:
        return 0
    return (sum(draw.textlength(ch, font=fnt) for ch in text)
            + tracking * (len(text) - 1))


def draw_tracked(draw, x, cy, text, fnt, fill, tracking):
    for ch in text:
        draw.text((x, cy), ch, font=fnt, fill=fill, anchor='lm')
        x += draw.textlength(ch, font=fnt) + tracking


def headline(canvas, top, lines):
    """Centered bold lines; each line is a list of (text, color) segments."""
    d = ImageDraw.Draw(canvas)
    fnt = font = ImageFont.truetype(F_BOLD, 92)
    for segs in lines:
        width = sum(d.textlength(t, font=font) for t, _ in segs)
        assert width <= 960, f'headline too wide ({width:.0f}px): {segs}'
    for i, segs in enumerate(lines):
        cy = top + i * 112
        width = sum(d.textlength(t, font=fnt) for t, _ in segs)
        x = (W - width) / 2
        for text, color in segs:
            d.text((x, cy), text, font=fnt, fill=color + (255,), anchor='lm')
            x += d.textlength(text, font=fnt)


def prose(canvas, top, lines):
    d = ImageDraw.Draw(canvas)
    fnt = ImageFont.truetype(F_REG, 37)
    for line in lines:
        width = d.textlength(line, font=fnt)
        assert width <= 920, f'prose too wide ({width:.0f}px): {line}'
    for i, line in enumerate(lines):
        d.text((W / 2, top + i * 52), line, font=fnt, fill=MUTED + (255,),
               anchor='ma')


def phone_layer(screen):
    """Simplified Pixel 7 front matching the emulator device profile."""
    bezel = 16
    sw, sh = screen.size
    fw, fh = sw + 2 * bezel, sh + 2 * bezel
    m = 48
    layer = Image.new('RGBA', (fw + 2 * m, fh + 2 * m), (0, 0, 0, 0))
    d = ImageDraw.Draw(layer)
    x, y = m, m
    r_frame = round(fh * 0.0617)
    d.rounded_rectangle((x - 5, y - 5, x + fw + 5, y + fh + 5),
                        r_frame + 4, fill=(30, 27, 19, 255))
    d.rounded_rectangle((x, y, x + fw, y + fh), r_frame, fill=(6, 6, 5, 255))
    rounded_paste(layer, screen, (x + bezel, y + bezel),
                  round(sh * 0.0457))
    cx = x + bezel + sw // 2
    hole = round(sh * 0.0086)
    d.ellipse((cx - hole, y + bezel - 6, cx + hole, y + bezel + 6 + hole - 6),
              fill=(3, 3, 3, 255))
    return layer


def paste_tilted(canvas, layer, center, angle):
    rot = layer.rotate(angle, resample=Image.Resampling.BICUBIC, expand=True)
    alpha = rot.getchannel('A')
    shadow = Image.new('RGBA', rot.size, (0, 0, 0, 255))
    shadow.putalpha(alpha.point(lambda a: int(a * 0.72)))
    shadow = shadow.filter(ImageFilter.GaussianBlur(22))
    px = round(center[0] - rot.width / 2)
    py = round(center[1] - rot.height / 2)
    canvas.alpha_composite(shadow, (px, py + 20))
    canvas.alpha_composite(rot, (px, py))


def detail_card(crop, caption):
    """Enlarged crop with a yellow keyline and a caption chip beneath."""
    pad, chip_h, gap = 12, 58, 16
    w = crop.width + 2 * pad
    h = crop.height + 2 * pad + gap + chip_h
    layer = Image.new('RGBA', (w, h), (0, 0, 0, 0))
    d = ImageDraw.Draw(layer)
    d.rounded_rectangle((0, 0, w - 1, crop.height + 2 * pad), 36,
                        fill=(13, 12, 9, 255), outline=YELLOW + (255,), width=3)
    rounded_paste(layer, crop, (pad, pad), 26)

    fb = ImageFont.truetype(F_BOLD, 27)
    tw = tracked_width(d, caption, fb, 2.5)
    chip_w = round(tw + 56)
    x0 = (w - chip_w) / 2
    y0 = crop.height + 2 * pad + gap
    d.rounded_rectangle((x0, y0, x0 + chip_w, y0 + chip_h), chip_h / 2,
                        fill=YELLOW + (255,))
    draw_tracked(d, x0 + 28, y0 + chip_h / 2, caption, fb, (26, 22, 11), 2.5)
    return layer


def render(spec):
    image = vgrad((W, H), BG_TOP, BG_BOT).convert('RGBA')
    image.alpha_composite(glow(image.size, (540, 990), 560, YELLOW, 44))
    image.alpha_composite(glow(image.size, (236, 1668), 430, GREEN, 34))
    image.alpha_composite(ripples(image.size, spec['center']))
    image.alpha_composite(vignette(image.size))

    headline(image, HEAD_TOP, spec['head'])
    prose(image, PROSE_TOP, spec['prose'])

    original = Image.open(ROOT / 'source' / spec['source']).convert('RGB')
    framed = original.crop(spec['zoom']) if spec.get('zoom') else original
    screen = framed.resize(spec['screen'], Image.Resampling.LANCZOS)
    dim = spec.get('dim')
    if dim:
        # Gently de-emphasize the screen; the enlarged callout is an
        # unaltered crop from the same capture.
        blur, brightness = dim
        screen = ImageEnhance.Brightness(
            screen.filter(ImageFilter.GaussianBlur(blur))).enhance(brightness)
    paste_tilted(image, phone_layer(screen), spec['center'], spec['tilt'])

    card = spec.get('card')
    if card:
        box, width, caption, center, angle = card
        crop = original.crop(box)
        crop = crop.resize((width, round(crop.height * width / crop.width)),
                           Image.Resampling.LANCZOS)
        paste_tilted(image, detail_card(crop, caption), center, angle)

    noise = Image.effect_noise(image.size, 14).convert('RGB')
    final = Image.blend(image.convert('RGB'), noise, 0.032)
    final.save(OUT / spec['out'], optimize=True)
    print(f"rendered {spec['out']}")


# Shots that show the app itself: the entire device stays inside the frame.
render({
    'source': 'home.png',
    'out': '01-access.png',
    'tilt': -3.5,
    'screen': (615, 1367),
    'center': (540, 1187),
    'head': [[('Knock once,', YELLOW)],
             [('and you’re in.', INK)]],
    'prose': ['Your homelab stays invisible to the internet',
              'until you knock. No VPN, no exposed ports.'],
})

# Shade shots: zoom into the shade; the frame may bleed off the bottom.
# The card tilts with the phone and hovers over the real tile position.
render({
    'source': 'tile.png',
    'out': '02-quick-settings.png',
    'tilt': 4,
    'screen': (640, 1422),
    'center': (540, 1235),
    'zoom': (0, 120, 760, 1809),
    'head': [[('Knock-knock,', YELLOW)],
             [('from anywhere.', INK)]],
    'prose': ['One tap on the Quick Settings tile whitelists',
              'you, even with the app closed.'],
    'dim': (2, 0.78),
    'card': ((40, 1015, 535, 1210), 470, 'QUICK SETTINGS TILE',
             (430, 1340), 5),
})

render({
    'source': 'renew.png',
    'out': '03-auto-renew.png',
    'tilt': -4,
    'screen': (615, 1367),
    'center': (540, 1187),
    'dim': (1.5, 0.9),
    'head': [[('Access that', INK)],
             [('renews itself.', YELLOW)]],
    'prose': ['Knocks expire. Knocker re-knocks before they',
              'end, and whenever your network changes.'],
    # The Auto-renew row from the editor: label, subtitle and its ON switch.
    'card': ((28, 895, 1052, 1065), 680, 'AUTO-RENEW IS ON',
             (540, 1063), -5),
})

# The notification spans the shade, so its card sits centered over it and
# tilts in the same direction as the phone.
render({
    'source': 'notification.png',
    'out': '04-notifications.png',
    'tilt': 3.5,
    'screen': (640, 1422),
    'center': (540, 1235),
    'zoom': (0, 150, 831, 1996),
    'head': [[('Every knock', INK)],
             [('gets an answer.', YELLOW)]],
    'prose': ['Results land the instant a background knock',
              'completes; you always know you’re in.'],
    'dim': (2, 0.78),
    'card': ((40, 1120, 1040, 1425), 660, 'KNOCK RESULT',
             (540, 1375), 4),
})
