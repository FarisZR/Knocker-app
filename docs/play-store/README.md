# Google Play phone screenshots

The three 1080 × 1920 PNGs in `screenshots/` are ordered for the listing and written for someone who has never heard of Knocker:

1. `01-what-it-is.png`: the pitch and the three steps of a knock, over the home screen.
2. `02-auto-renew.png`: how auto-renew recovers access after a network change (new network, new IP, Knocker knocks again), over the profile editor with the Auto-renew switch on.
3. `03-quick-settings.png`: knocking from the Quick Settings tile, with the result notification.

## Artwork

Everything is laid out in `shots.html`, one `<section class="shot">` per image, and screenshotted by `render.py` with headless Chromium. Every shot uses the same three parts and nothing else:

- A headline in Inter Bold with one Knocker-yellow phrase.
- A short monospace block (JetBrains Mono) that explains the feature in a few aligned lines.
- An upright device frame around an unaltered Pixel 7 Android 16 emulator capture from `source/` (dark mode, yellow Material You palette). Shot 3 adds one unaltered crop of the notification capture and a "one tap" pointer.

Both fonts are vendored in `fonts/` under the SIL OFL 1.1. Addresses come from the documentation ranges (`203.0.113.42`, `198.51.100.7`). The capture profile used a temporary demo server, so its hostname is not a production endpoint.

## Regenerating

```sh
uv run --with playwright python -m playwright install chromium   # first time only
uv run --with playwright python docs/play-store/render.py
```

Open `shots.html` in a browser to iterate on layout before rendering.
