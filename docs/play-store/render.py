#!/usr/bin/env python3
"""Render the Play Store listing images from shots.html.

Each <section class="shot"> in shots.html is a 1080 x 1920 canvas laid out
with HTML/CSS around unaltered crops of the emulator captures in source/.
This script screenshots every section with headless Chromium.

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
}

OUT.mkdir(exist_ok=True)
with sync_playwright() as p:
    browser = p.chromium.launch()
    page = browser.new_page(viewport={'width': 1080, 'height': 1920},
                            device_scale_factor=1)
    page.goto((ROOT / 'shots.html').as_uri())
    page.evaluate('document.fonts.ready')
    page.wait_for_load_state('networkidle')
    for section, name in SHOTS.items():
        page.locator(f'#{section}').screenshot(path=str(OUT / name))
        print(f'rendered {name}')
    browser.close()
