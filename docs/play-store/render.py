#!/usr/bin/env python3
"""Render Play listing images from emulator captures. Requires Pillow."""
from pathlib import Path
from PIL import Image, ImageDraw, ImageFont, ImageFilter, ImageEnhance

ROOT = Path(__file__).resolve().parent
OUT = ROOT / 'screenshots'
OUT.mkdir(exist_ok=True)
FONT = '/usr/share/fonts/opentype/urw-base35/NimbusSans-Regular.otf'

def center(draw, y, text, font):
    box = draw.textbbox((0, 0), text, font=font)
    draw.text(((1080 - (box[2] - box[0])) / 2, y), text, font=font, fill='#f7f4e9')

def rounded_paste(canvas, img, xy, radius):
    mask = Image.new('L', img.size)
    ImageDraw.Draw(mask).rounded_rectangle((0, 0, img.width - 1, img.height - 1), radius, fill=255)
    canvas.paste(img, xy, mask)

def render(source, name, lines, focus=None):
    image = Image.new('RGBA', (1080, 1920), '#15140f')
    draw = ImageDraw.Draw(image)
    headline = ImageFont.truetype(FONT, 80)
    for i, line in enumerate(lines):
        center(draw, 125 + i * 90, line, headline)

    # A simplified Pixel 7 front, matching the emulator's device profile.
    x, y, w, h = 209, 455, 662, 1488
    shadow = Image.new('RGBA', image.size)
    ImageDraw.Draw(shadow).rounded_rectangle((x - 9, y + 10, x + w + 9, y + h + 20), 90, fill=(0, 0, 0, 130))
    image = Image.alpha_composite(image, shadow.filter(ImageFilter.GaussianBlur(24)))
    draw = ImageDraw.Draw(image)
    draw.rounded_rectangle((x - 4, y - 4, x + w + 4, y + h + 4), 85, fill='#5c5b54')
    draw.rounded_rectangle((x, y, x + w, y + h), 80, fill='#080807')
    original = Image.open(ROOT / 'source' / source).convert('RGB')
    screen = original.resize((630, 1400), Image.Resampling.LANCZOS)
    if focus:
        # De-emphasize the rest of the system shade; the enlarged detail below
        # is an unaltered crop from the same emulator screenshot.
        screen = ImageEnhance.Brightness(screen.filter(ImageFilter.GaussianBlur(18))).enhance(.42)
    rounded_paste(image, screen, (x + 16, y + 18), 65)
    draw = ImageDraw.Draw(image)
    draw.ellipse((534, y + 28, 546, y + 40), fill='#050505')
    if focus:
        box, width, top = focus
        crop = original.crop(box)
        crop = crop.resize((width, round(crop.height * width / crop.width)), Image.Resampling.LANCZOS)
        left = (1080 - width) // 2
        shade = Image.new('RGBA', image.size)
        ImageDraw.Draw(shade).rounded_rectangle((left-4, top+10, left+width+4, top+crop.height+14), 55, fill=(0, 0, 0, 160))
        image = Image.alpha_composite(image, shade.filter(ImageFilter.GaussianBlur(22)))
        rounded_paste(image, crop, (left, top), 45)
    image.convert('RGB').save(OUT / name, optimize=True)

render('home.png', '01-access.png', ['Your server.', 'Ready when you are.'])
render('tile.png', '02-quick-settings.png', ['A knock is just', 'a swipe away.'], ((40, 1015, 535, 1210), 860, 1010))
render('renew.png', '03-auto-renew.png', ['Access that follows', 'your network.'])
render('notification.png', '04-notifications.png', ['Know when', 'your knock lands.'], ((40, 1120, 1040, 1425), 950, 990))
