#!/usr/bin/env python3
"""Render Play listing images from emulator captures. Requires Pillow."""
from pathlib import Path
from PIL import Image, ImageDraw, ImageFont, ImageFilter

ROOT = Path(__file__).resolve().parent
OUT = ROOT / 'screenshots'
OUT.mkdir(exist_ok=True)
BOLD = '/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf'
REGULAR = '/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf'

def font(size, bold=False): return ImageFont.truetype(BOLD if bold else REGULAR, size)
def centered(draw, y, text, f, fill):
    box = draw.textbbox((0, 0), text, font=f)
    draw.text(((1080-(box[2]-box[0]))/2, y), text, font=f, fill=fill)

def render(source, name, kicker, lines, sub):
    image = Image.new('RGB', (1080, 1920), '#11110f')
    d = ImageDraw.Draw(image)
    # Quiet warm geometry echoes the app's yellow accent.
    d.ellipse((-420, 700, 520, 1640), fill='#1d1c14')
    d.ellipse((730, 350, 1400, 1020), fill='#1b1a13')
    d.rounded_rectangle((411, 69, 669, 116), 24, fill='#302e1d')
    centered(d, 78, kicker, font(21, True), '#ffe66a')
    for i, line in enumerate(lines): centered(d, 155+i*86, line, font(70, True), '#f8f5ed')
    centered(d, 155+len(lines)*86+14, sub, font(28), '#c7c4b9')
    # Pixel 7 front profile: rounded corners, dark bezel and centred camera.
    x, y, w, h = 209, 505, 662, 1488
    shadow = Image.new('RGBA', image.size)
    sd = ImageDraw.Draw(shadow); sd.rounded_rectangle((x-15,y+12,x+w+15,y+h+25), 92, fill=(0,0,0,160))
    image = Image.alpha_composite(image.convert('RGBA'), shadow.filter(ImageFilter.GaussianBlur(28)))
    d = ImageDraw.Draw(image)
    d.rounded_rectangle((x-6,y-3,x+w+6,y+h+3), 86, fill='#686862')
    d.rounded_rectangle((x,y,x+w,y+h), 81, fill='#090909')
    shot = Image.open(ROOT/'source'/source).convert('RGB').resize((630, 1400), Image.Resampling.LANCZOS)
    mask = Image.new('L', shot.size); ImageDraw.Draw(mask).rounded_rectangle((0,0,629,1399), 65, fill=255)
    image.paste(shot, (x+16,y+18), mask)
    d = ImageDraw.Draw(image); d.ellipse((534,y+28,546,y+40), fill='#050505')
    image.convert('RGB').save(OUT/name, optimize=True)

render('home.png','01-access.png','KNOCKER', ['Your server,', 'one tap away'], 'Keep access close at hand')
render('tile.png','02-quick-settings.png','QUICK SETTINGS', ['Knock without', 'opening the app'], 'A shortcut right in your shade')
render('renew.png','03-auto-renew.png','AUTO-RENEW', ['Stay connected', 'automatically'], 'Checks network changes and renews before expiry')
render('notification.png','04-notifications.png','NOTIFICATIONS', ['See your latest', 'knock at a glance'], 'Get updates when a background knock finishes')
