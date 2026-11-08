# Google Play phone screenshots

The four 1080 × 1920 PNGs in `screenshots/` are ordered for the listing. They use dark-mode captures from the Pixel 7 Android 16 emulator and a simplified Pixel 7 front frame. The example profile used a temporary demo server and the documentation address `203.0.113.42`; the server and key were disposable. The notification capture was produced by a Quick Settings knock against that server. Background renewals use the same notification presentation.

## Artwork

Each image is composed in `render.py` from the matching emulator capture in `source/`:

- Warm near-black gradient backdrop with a soft Knocker-yellow glow, a faint secondary green glow (echoing the active-grant state), and concentric "knock ripple" rings fading outward from the device: the project's knock-knock motif.
- Headlines are set in Nimbus Sans Bold with one Knocker-yellow phrase per shot, followed by a one-sentence explainer in muted prose. Shots 1 and 2 lead with the yellow phrase, shots 3 and 4 close with it.
- No brand block is drawn: the app's own top bar already carries the Knocker wordmark in the home capture.
- Shots 1 and 3 show the app itself, so the entire device is framed and nothing is cropped. The device is tilted a few degrees, alternating direction between shots.
- Shots 2 and 4 show the system shade, where the bottom of the capture does not matter: the screen content is zoomed in about 1.3 to 1.4 times and the frame may bleed off the bottom edge.
- Shots 2, 3 and 4 add an enlarged callout card with a yellow keyline and a caption chip over a gently dimmed, blurred screen. The crop inside the card is an unaltered enlargement from the same capture. The card tilts in the same direction as the phone and hovers where the highlighted element actually sits: on the left for the Quick Settings tile, centered for the Auto-renew row and the notification. Shot 3's caption marks the toggle the editor actually shows ("Auto-renew", with its explanatory subtitle, switched on in the capture).
- A subtle vignette and film grain keep the dark gradient from banding.

## Regenerating

On Linux, install the dependencies and run from the repository root:

```sh
python3 -m pip install pillow
python3 docs/play-store/render.py
```

Requirements: Pillow and the URW Base 35 fonts (Nimbus Sans Regular + Bold, e.g. Debian's `fonts-urw-base35` package).

Android's yellow Material You palette was selected on the emulator for the captures. The source capture includes the temporary demo hostname; it is not a production endpoint.
