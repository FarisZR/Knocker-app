# Google Play screenshots

Two sets, each ordered for the listing and written for someone who has never heard of Knocker.

## Phone

The three 1080 × 1920 PNGs in `screenshots/`:

1. `01-what-it-is.png`: the pitch and the three steps of a knock, over the home screen.
2. `02-auto-renew.png`: how auto-renew recovers access after a network change (new network, new IP, Knocker knocks again), over the profile editor with the Auto-renew switch on.
3. `03-quick-settings.png`: knocking from the Quick Settings tile, with the result notification.

## 10-inch tablet

The three 2560 × 1440 PNGs in `screenshots/tablet/`, matching the three phone shots. Play asks for 16:9 landscape or 9:16 portrait with every side between 1,080 and 7,680 px. It recommends at least four tablet screenshots, so add a fourth here if large-screen promotion matters. Upload the same set for 7-inch tablets if that slot is used. The set shows both tablet layouts: home across the whole window when nothing is open, and the profile list beside an open profile.

1. `01-what-it-is.png`: the pitch and the three steps of a knock, over the full-window home: five whitelisted servers in columns, with Knock all and the pinned knock in the bottom-right corner.
2. `02-auto-renew.png`: the auto-renew story, with the Auto-renew switch spotlit in Home server's open profile. Home server (auto-renew on) has knocked again from the new address `198.51.100.7`. In the dimmed list, NAS (auto-renew off) still holds its old grant and shows the amber "IP changed · not whitelisted" footer.
3. `03-quick-settings.png`: the tablet's split shade. The Knocker tile is in Quick Settings and its result notification sits beside it.

## Artwork

Everything is laid out in `shots.html` and screenshotted by `render.py` with headless Chromium: one `<section class="shot">` per phone image (1080 × 1920 at 1×) and one `<section class="tshot">` per tablet image (1920 × 1080 rendered at 4/3). Every shot uses the same three parts and nothing else:

- A headline in Inter Bold with one Knocker-yellow phrase.
- A short monospace block (JetBrains Mono) that explains the feature in a few aligned lines.
- An upright device frame around an unaltered Android 16 emulator capture from `source/`: a Pixel 7 for phones, a Pixel Tablet in landscape (2560 × 1600) for tablets. Phone shot 3 adds one unaltered crop of the notification capture, both tile shots add a "one tap" pointer, and tablet shot 2 dims the screen around the Auto-renew row (`.spot`) with a short label.

Phone sources: `home.png` and `renew.png` show the native Compose design (top-bar New profile action, list-row editor with the floating Save action). `tile.png` and `notification.png` are system UI and did not change with that redesign. Recapture `home.png` and `renew.png` whenever the home screen or profile editor changes.

Tablet sources: `tablet-home.png`, `tablet-renew.png` and `tablet-tile.png`. Recapture them whenever the home screen or profile editor changes. They were captured with:

- the `Knocker_Tablet_API36` AVD (`pixel_tablet`, Android 16), in dark mode;
- SystemUI demo mode with the clock at 9:05, a full battery, Wi-Fi only and status icons hidden;
- the system palette seeded with Knocker yellow (`FDE562`), so the Quick Settings shade matches the listing;
- the Knocker tile resized to its large, labelled form, and the emulator's "Serial console enabled" notice snoozed;
- exact-alarm access allowed, so the editor does not show the "Allow precise renewal" prompt.

Both fonts are vendored in `fonts/` under the SIL OFL 1.1. Addresses come from the documentation ranges (`203.0.113.42`, `198.51.100.7`). The capture profiles used a temporary demo server, so its hostname is not a production endpoint. For the tablet set, `scripts/network-test-server.mjs` was adapted to keep one grant per endpoint path, which gives each profile an independent state. Only these two documentation addresses appear in the captures; the fixture reports them in place of the caller's real address.

## Regenerating

```sh
uv run --with playwright python -m playwright install chromium   # first time only
uv run --with playwright python docs/play-store/render.py
```

Open `shots.html` in a browser to iterate on layout before rendering.
