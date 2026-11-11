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
# Run from the repository root.

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

Auto-renew is off for new profiles. Quick Settings tiles and foreground knocks
do not require exact-alarm access. Enabling Auto-renew reveals the permission
dialog if access is missing, explaining why timely renewal needs alarms and
reminders. **Open settings** opens the system permission screen; **Not now**
keeps the inexact fallback. Saved renewal choices are preserved.

When Auto-renew is enabled in the profile editor, the prominent **Allow precise
renewal** button reopens this explanation if access is missing. Denying
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

- [x] With alarms-and-reminders access denied, save an auto-renew profile;
      confirm no crash, an inexact scheduled alarm and an honest delay warning.
- [x] Grant access from the editor, return and confirm the permission action
      disappears and the pending alarm upgrades without another save or knock.
- [x] Revoke access with an exact renewal pending; confirm its independent
      inexact backup remains and delivers while the app is closed.
- [x] Invoke an assigned Quick Settings tile with Knocker backgrounded,
      Auto-renew off and exact-alarm access denied. Confirm HTTP success, an active
      tile and no scheduled renewal alarms.
- [ ] Repeat tile invocation after ordinary process death, and with a denied
      response followed by retry.
- [ ] Observe renewal with the screen off and in Doze. Record actual dispatch
      and expiry times rather than treating alarm registration as HTTP delivery.
- [ ] Change Wi-Fi/cellular connectivity and confirm recovery. Check reboot
      separately: AlarmManager alarms are
      cleared on reboot; the boot receiver restores enabled renewal alarms and the network subscription.
- [ ] Against live Caddy, verify successful/denied knocks, server-capped TTL,
      tile invocation and background renewal. Check physical haptic feel on hardware.

Release-build checks above passed on the Android 16 emulator on 2026-11-07,
using the HTTPS fixture, fake credentials, TTL 180 seconds and a 120-second
safety window. Denied access registered one inexact alarm. Granting access
registered an exact alarm plus backup and removed the editor warning. The
server observed one renewal at 14:49:55 UTC and the next at 14:50:58 UTC.
Revocation killed the app process and removed the exact alarm; the backup
survived and renewed at 14:52:32 UTC without reopening Knocker.

After the user added Knock 1, a tile tap with Auto-renew disabled and alarm
access denied sent one request at 15:00:42 UTC, completed at 15:00:43 UTC,
activated the tile and left zero renewal alarms. The device tool reported a
foreground-app mismatch, but the server response and tile screenshot confirm
the action succeeded. A cold tile process was not established by the attempted
background process kill, so that case is not marked passed.

The previous opt-in Compose test and manual release checks passed: a new
profile starts with Auto-renew off, enabling it reveals the alarm-permission
action when access is missing, and disabling it removes the action. The test
`backgroundRenewalIsOptInAndPermissionControlsFollowTheSwitch` now also checks
the explanation dialog, dismissal and reopening. This extended test passed
after the emulator was restarted. Manual checks in the optimized release also
confirmed the popup appears on enabling Auto-renew and **Open settings** opens
Android's alarms-and-reminders screen. Screen-off/Doze,
reboot, remaining tile cases,
live Caddy and physical haptic feel remain pending.

## Network changes and server status

Auto-renew also checks the current connection after Wi-Fi/cellular/default-network
changes. A native default-network callback handles a running process; a system-owned
PendingIntent watches for availability of the next Wi-Fi/cellular transport.
Delivered subscriptions are rearmed after the connection settles.
One unique WorkManager batch waits five seconds for handover, then checks authenticated
`GET /status` on each enabled self-knock profile's server. It knocks only when the
server explicitly reports no coverage. Checks are limited to one per profile per minute,
with at most three backoff retries. No polling or persistent foreground service is used.
Android battery restrictions can delay work, and availability notifications do not
guarantee delivery for every default-route switch when the process is absent.

Foreground status checks also run with Auto-renew disabled. An uncovered current
address appears in the amber profile footer beside the retained last-knock IP;
covered addresses suppress the warning, including coverage from another knock/CIDR.
Failed or unsupported status requests remain unverified and never trigger a knock.
Remote-IP overrides retain their existing expiry renewal and are excluded from
current-source-IP checks.

Installed debug QA on Android 16 verified a Wi-Fi-to-cellular warning with
Auto-renew off, suppression when the new IP was already covered, and one
status request followed by one knock after a cellular-to-Wi-Fi transition
with Knocker on the launcher. These checks used fake credentials and an
HTTPS fixture; they do not establish physical-device or Doze timing.

The alarm-permission explanation describes both expiry renewal and network-change
recovery, and makes clear that network recovery works without exact-alarm access.
Foreground status requests use Expo Fetch with redirect rejection, while native
status reads are capped at 16 KiB and a four-second total deadline. Unknown fallback
status results have bounded retries; successful knocks cannot create a refresh loop.

Same-transport reconnections after process death remain outside the requested
Wi-Fi/cellular handover scope. An availability notification can also be consumed
while the default transport stays unchanged. Automatically re-registering a request
that is already satisfied would cause repeated wakeups; the live default-network
callback and existing expiry renewal remain the recovery paths in that case.
