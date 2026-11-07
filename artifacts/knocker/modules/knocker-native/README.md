# knocker-native

Local Expo module that adds two Android-only features to Knocker:

1. **Quick Settings tiles** — up to 5 `TileService` instances
   (`KnockerTileService1`–`KnockerTileService5`). The user pins one or more from
   the pull-down panel; tapping a tile fires a knock for the assigned profile,
   even if the Knocker app is fully killed.
2. **Background auto-renew** — `RenewAlarmReceiver` schedules itself with
   `AlarmManager.setExactAndAllowWhileIdle` so a renewal knock fires before
   each profile's whitelist entry expires, even when the app process is gone.
   Precise scheduling requires the user's alarms-and-reminders grant on
   Android 12+; without it, renewal uses an inexact alarm and may arrive late.

Neither feature exists in Expo Go. They require a custom dev or production
build that includes this module.

## Architecture

- **JS bridge** (`index.ts`) exposes `syncProfiles`, `loadProfilesFromNative`,
  `scheduleRenewal`, `cancelRenewal`, `cancelAllRenewals`,
  `canScheduleExactAlarms`, and `openExactAlarmSettings`.
  `isNativeAvailable` is `true` only on Android builds that include the
  module.
- **Storage** (`KnockerStore.kt`) writes the profile snapshot to
  `EncryptedSharedPreferences` so the tile services and the alarm receiver can
  read profile data (including the API key) without touching the JS runtime.
  The JS side pushes the snapshot whenever profiles change.
- **HTTP** (`KnockerHttp.kt`) reimplements `lib/knock.ts` against
  `HttpURLConnection` so the native side can knock on its own.
- **Tiles** (`KnockerTileService.kt`) — base class plus 5 thin subclasses, one
  per slot. The base class looks up the profile assigned to its slot and fires
  the knock on a background thread, then updates the tile state.
- **Alarms** (`RenewAlarmReceiver.kt`, `RenewWorker.kt`) — the receiver quickly
  hands work to `WorkManager`, and the worker performs the HTTP knock + next
  renewal scheduling. Falls back to `setAndAllowWhileIdle` if the user has
  revoked the exact-alarm permission on Android 12+.

## Permissions

The config plugin (`app.plugin.js`) injects:

- `INTERNET` — for the knock HTTP call.
- `SCHEDULE_EXACT_ALARM` — user-granted alarms-and-reminders access on Android
  12+ for `setExactAndAllowWhileIdle`. Knocker does not request the restricted
  `USE_EXACT_ALARM` permission.
- `POST_NOTIFICATIONS` — for tile and renewal results.

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
4. Close the app normally and tap the tile. You should get a toast and the tile
   state should update even while the app is closed. Force-stop is a separate
   Android restriction, not ordinary process death.
5. Enable "Auto-renew" on a profile and observe renewal requests on the test
   server while the app is closed.

When Auto-renew is enabled in the profile editor, **Allow precise renewal**
opens Android's alarms-and-reminders settings if access is missing. Denying
access keeps the inexact fallback; granting access does not guarantee timely
network work during Doze.

On Android 12+, each pending renewal keeps an independent inexact backup even
while exact access is granted. The two alarms share a persisted generation token: the
receiver accepts one current delivery and cancels its sibling, while rejecting
old deliveries after rescheduling. Android's permission-granted broadcast
upgrades still-pending renewals without requiring another save or knock.

## Background release QA

Use the installed release build, a dedicated test endpoint/key and server-side
request timestamps. The [controlled fixture](../../scripts/ui-test-server.mjs)
checks client behavior but does not establish live Caddy compatibility.

- [ ] With alarms-and-reminders access denied, save an auto-renew profile;
  confirm no crash, an inexact scheduled alarm and an honest delay warning.
- [ ] Grant access from the editor, return and confirm the permission action
  disappears; connect and observe renewal without reopening the app.
- [ ] Pin an assigned Quick Settings tile and invoke it with the app closed
  and after ordinary process death. Confirm the request, persisted grant and
  tile state; repeat with a denied response and retry.
- [ ] Observe renewal with the screen off and in Doze. Record actual dispatch
  and expiry times rather than treating alarm registration as HTTP delivery.
- [ ] Revoke alarm access with an exact renewal pending; confirm its independent
  inexact backup still delivers. Grant access again and confirm the pending
  renewal upgrades without saving or knocking. Change Wi-Fi/cellular connectivity
  and confirm recovery. Check reboot separately: AlarmManager alarms are
  cleared on reboot, and this module has no boot-time rescheduling receiver.
- [ ] Against live Caddy, verify successful/denied knocks, server-capped TTL,
  tile invocation and background renewal. Check physical haptic feel on hardware.

These checks remain pending as of 2026-11-07. Simulator discovery failed twice
with `Device support failed during waiting for the device hub to answer.`
No simulator or live-Caddy result is claimed for this change.
