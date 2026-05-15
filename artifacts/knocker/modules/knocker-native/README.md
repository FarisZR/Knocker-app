# knocker-native

Local Expo module that adds two Android-only features to Knocker:

1. **Quick Settings tiles** — up to 5 `TileService` instances
   (`KnockerTileService1`–`KnockerTileService5`). The user pins one or more from
   the pull-down panel; tapping a tile fires a knock for the assigned profile,
   even if the Knocker app is fully killed.
2. **Background auto-renew** — `RenewAlarmReceiver` schedules itself with
   `AlarmManager.setExactAndAllowWhileIdle` so a renewal knock fires before
   each profile's whitelist entry expires, even when the app process is gone.

Neither feature exists in Expo Go. They require a custom dev or production
build that includes this module.

## Architecture

- **JS bridge** (`index.ts`) exposes `syncProfiles`, `scheduleRenewal`,
  `cancelRenewal`, `cancelAllRenewals`, `canScheduleExactAlarms`, and
  `openExactAlarmSettings`. `isNativeAvailable` is `true` only on Android
  builds that include the module.
- **Storage** (`KnockerStore.kt`) writes the profile snapshot to
  `EncryptedSharedPreferences` so the tile services and the alarm receiver can
  read profile data (including the API key) without touching the JS runtime.
  The JS side pushes the snapshot whenever profiles change.
- **HTTP** (`KnockerHttp.kt`) reimplements `lib/knock.ts` against
  `HttpURLConnection` so the native side can knock on its own.
- **Tiles** (`KnockerTileService.kt`) — base class plus 5 thin subclasses, one
  per slot. The base class looks up the profile assigned to its slot and fires
  the knock on a background thread, then updates the tile state.
- **Alarms** (`RenewAlarmReceiver.kt`) — `BroadcastReceiver` that uses
  `goAsync()` to perform the HTTP knock off the main thread, then reschedules
  the next renewal. Falls back to `setAndAllowWhileIdle` if the user has
  revoked the exact-alarm permission on Android 12+.

## Permissions

The config plugin (`app.plugin.js`) injects:

- `INTERNET` — for the knock HTTP call.
- `SCHEDULE_EXACT_ALARM` (pre-Android 13) and `USE_EXACT_ALARM` (Android 13+) —
  for `setExactAndAllowWhileIdle`.

It also injects the `<service>` and `<receiver>` entries the tiles & alarm
receiver need.

## Running on a device

This module is **not** available in Expo Go. To test on a physical device:

```sh
cd artifacts/knocker

# Option A — DEV build (fast iteration, requires Metro running on your machine).
# The device must be USB-connected or on the same Wi-Fi as your dev machine.
pnpm android:debug

# Option B — RELEASE build (self-contained APK, no Metro needed).
# This is what you want for everyday use; the JS bundle is baked in.
pnpm android:release

# Option C — just produce a shareable APK file (no install).
pnpm android:apk
# → APK path is printed at the end (android/app/build/outputs/apk/release/app-release.apk)
```

> **"Unable to load script… index.android.bundle"** red screen?
> You built the **debug** variant and Metro is not reachable from the device.
> Either keep `pnpm dev` running on the same network, or rebuild with
> `pnpm android:release` so the JS bundle is embedded in the APK.

Then on the device:

1. Open the pull-down panel -> pencil/edit icon -> drag any "Knock 1...5"
   tile into the active set.
2. In Knocker, edit a profile and assign it to the matching slot in the
   "Quick Settings tile slot" picker.
3. The mapping is one-to-one: the Android tile named "Knock 3" triggers the
   profile assigned to slot `3` in Knocker.
4. Force-stop the app and tap the tile. You should get a toast and the tile
   state should update even while the app is closed.
5. Enable "Auto-renew before expiry" on a profile and observe that renewals
   continue even after the app is killed (logcat tag `KnockerRenewAlarm`).

If the in-app banner says "Exact alarms disabled", tap it to open the system
permission screen and grant the permission.
