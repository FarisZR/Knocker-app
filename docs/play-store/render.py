#!/usr/bin/env python3
"""Render the Play Store listing images from shots.html.

Each <section class="shot"> in shots.html is a 1080 x 1920 phone canvas, and
each <section class="tshot"> a 1920 x 1080 tablet canvas rendered at 4/3 to
2560 x 1440 (16:9, as Play requires for 10-inch tablets). Both are laid out
with HTML/CSS around unaltered emulator captures in source/. This script
screenshots every section with headless Chromium.

Run from anywhere:
    uv run --with playwright python docs/play-store/render.py
(first time only: uv run --with playwright python -m playwright install chromium)
"""
from pathlib import Path

from playwright.sync_api import sync_playwright

ROOT = Path(__file__).resolve().parent
OUT = ROOT / 'screenshots'
SHOTS = {
    's1': '01-what-it-is.png',
    's2': '02-auto-renew.png',
    's3': '03-quick-settings.png',
    's4': '04-notifications.png',
    'fg': '../feature-graphic.png',
}

TABLET_OUT = OUT / 'tablet'
TABLET_SHOTS = {
    't1': '01-what-it-is.png',
    't2': '02-auto-renew.png',
    't3': '03-quick-settings.png',
    't4': '04-notifications.png',
}


def render(browser, shots, out, viewport, scale):
    out.mkdir(exist_ok=True)
    page = browser.new_page(viewport=viewport, device_scale_factor=scale)
    page.goto((ROOT / 'shots.html').as_uri())
    page.evaluate('document.fonts.ready')
    page.wait_for_load_state('networkidle')
    for section, name in shots.items():
        page.locator(f'#{section}').screenshot(path=str(out / name))
        print(f'rendered {(out / name).resolve().relative_to(ROOT)}')
    page.close()


with sync_playwright() as p:
    browser = p.chromium.launch()
    render(browser, SHOTS, OUT, {'width': 1080, 'height': 1920}, 1)
    render(browser, TABLET_SHOTS, TABLET_OUT, {'width': 1920, 'height': 1080}, 4 / 3)
    browser.close()
