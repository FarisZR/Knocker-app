# Google Play phone screenshots

The four 1080 × 1920 PNGs in `screenshots/` are ordered for the listing. They use dark-mode captures from the Pixel 7 Android 16 emulator and a simplified Pixel 7 front frame. The example profile used a temporary demo server and the documentation address `203.0.113.42`; the server and key were disposable. The notification capture was produced by a Quick Settings knock against that server. Background renewals use the same notification presentation.

The original emulator captures are in `source/`. To regenerate the artwork on Linux, install Pillow and DejaVu Sans, then run `python3 docs/play-store/render.py` from the repository root. The source capture includes the temporary demo hostname; it is not a production endpoint.
