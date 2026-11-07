# Native Android Material 3 Expressive frontend

Android renders one `KnockerAppView`, an Expo native module containing a complete Kotlin/Jetpack Compose UI. Home, profile editing, navigation, app bars, text fields, keyboard handling, dialogs, loading indicators, feedback and the recovery screen live in that Compose tree. React Native supplies the root surface and data bridge; it does not draw Android controls or animate navigation.

`NativeHome.kt` and `NativeEditor.kt` use Material 3 `Scaffold`, app bars, native lazy scrolling, outlined fields, switches, chips, expressive buttons, loading indicators and `SnackbarHost`. `KnockerAppView.kt` uses Jetpack Navigation 3 `NavDisplay` for destination transitions and system/predictive back. Each destination has one app-bar title. Home uses the original vector wordmark in a roomier native top bar; profile counts and connection metadata no longer occupy a second header. There is no Expo Router modal header or second page heading above the editor.

The old per-control Expo UI wrappers and their button patch have been removed. The complete native surface uses Material 3's expressive theme and button-shape APIs directly. Current pins: Compose 1.12.1, Material 3 1.5.0-rc01, Navigation 3 1.2.1. Dynamic Material You colors follow Android appearance, with paired content/container colors and a contrasting green permission state.

## Interaction and feedback

Action feedback calls Android `View.performHapticFeedback` on the UI thread before dispatching a command. Taps use `CONTEXT_CLICK`; successful results use `CONFIRM`, and failures use `REJECT` on Android 11+. Older devices fall back to the supported click effect. System haptic preferences and foreground/window focus are respected. No vibration waveform or haptic promise delays a knock.

Single, bulk, retry and launch results carry an explicit outcome to the native surface, including successful results whose TTL is capped. Material loading, ripple, pressed-shape motion, snackbars and result visuals run natively. The attached warning footer explicitly starts hidden, including when a hydrated row already has a warning. Entry begins on the next native frame after the network snapshot, then slides down and expands with the expressive theme’s slow spatial spring and default fade; dismissal shrinks and fades. Full-navigation tests cover first composition, later network changes and repeated appearances while ensuring knock dispatch remains immediate. The list retains Compose’s standard Android overscroll behavior: scrollable content stretches at its boundaries; short lists do not get a custom stretch effect. Notice motion never gates a command. Navigation uses Jetpack's own transition and predictive-back implementation. Compose respects the system animation duration scale. Profiles have no entrance animation or minimum loading duration.

An active grant remains green during renewal. The draining ring retains its server-granted interval while a small native loader indicates renewal in progress. Profile names, endpoints, IP details and loading actions keep matching foreground/background colors. Expiry clears green state; a failed renewal retains still-valid access and reports the failure. Cards show status only for connecting, active or expired grants, plus a single “IP” line. Idle profiles have no “Ready to connect” badge. Pinned/auto-renew captions, empty-state instructions and redundant editor subtitles are removed. Each profile uses one elevated Material card with rounded expressive shapes, 16 dp content padding and 12 dp spacing. Connection changes appear in an attached amber footer within the same card outline, outside the clickable green status section. The shared container and elevation keep the notice visibly associated with its server. Optional public-IP checks live behind the Settings icon.

Successful confirmations use a short native snackbar and dismiss automatically, including launch results previously marked persistent. Success text is reduced to “Connected”; capped TTLs remain identified. Pending progress stays on the cards and actions without a duplicate loading snackbar. Failures retain their retry action.

The native scaffold measures the floating action stack and positions standard snackbar feedback above it. Native window/IME insets and a scrollable, width-constrained form handle compact, rotated and larger windows. Drafts remain local to their navigation destination; text, selection and keyboard edits do not round-trip through JavaScript. Back asks before discarding edits, save waits for a persistence acknowledgement, and failures leave the draft open. Tokenless action failures cannot overwrite editor acknowledgements; feedback IDs increment independently of wall-clock time.

## Data, startup and privacy

The React bridge is `components/NativeApp.android.tsx`. It sends immutable rendering snapshots and handles commands against the existing profile and network contexts. Those contexts own secure key storage, persistence, permission-target validation and grant ordering. Native snapshot hydration assigns collision-free rendering keys to duplicate or missing IDs without rewriting saved IDs, dropping profiles or moving secrets. Tokenless action failures are logged without touching the editor acknowledgement channel. `ProfileForm.kt` validates HTTPS URLs, bounded numeric values and numeric IP/CIDR literals without DNS lookups. Save sends settings only; current grant metadata is merged by the shared store.

This PR supersedes PR #14, including its cached native startup batch, concurrent dispatch, shared results and fallback behavior. The package ID is deliberately `com.fariszr.knocker`, matching #14. The previous ID was `dev.faris.knocker`: this is an authorized hard cutover with a separate installation and no profile migration.

After the first visible frame, one cached Android startup batch begins independently of JavaScript profile/key hydration. The encrypted cache, HTTP and renewal scheduling remain off the UI thread. Launch, tile, foreground and renewal callers share `KnockerRequests`, keyed by profile and actual HTTP inputs. Repeated starts/readers do not duplicate requests, and each launch future settles independently so one exceptional request does not discard successful siblings.

Successful in-flight grants survive rename, pin, slot, TTL and renewal edits. Endpoint, key or normalized IP-target changes invalidate them. Native storage uses the latest renewal settings and preserves newer grants. Both JS merge paths preserve later attempt failures while recovering earlier valid permissions. Snapshot writes remain serialized. The optimized build retains the WorkManager/Room reflection keep rules.

Local connection identity detects Wi-Fi/cellular/default-network changes without SSID, location or a public-IP service. Public-IP comparison is opt-in and off by default. The native dialog names ipify and explains disclosure before enabling it. Existing checks remain same-family/CIDR aware, foreground-only, cancellable, bounded to four seconds and independent of knocking. Turning them off cancels requests and clears comparison data.

## State ownership and failure guarantees

Navigation stores one current route; the two-screen Navigation 3 stack is derived from it. Discard confirmation stores a destination rather than an executable callback. New drafts use an absent profile ID, so a saved ID such as `new` still opens the existing editor. The old Android branches in the web/iOS screens, no-op native-control wrappers, unused feedback mode and grant-merge alias are removed.

The remaining coordination state has distinct jobs: draft/baseline comparison protects edits; a matching save/delete token acknowledges persistence; pending counts cover overlapping JS consumers and native requests; shared request futures prevent duplicate HTTP; grant identity and timestamps reject responses for changed targets or older permissions. Startup cancellation and settlement share one cleanup that releases their pending count once. Navigation entry snapshot reads and the notice's initial hidden frame remain necessary for previously reproduced rendering bugs.

Storage read errors and malformed metadata reject hydration instead of becoming an empty list or empty key that a later save could overwrite. The existing native recovery screen offers retry. Key, metadata and native-cache write errors propagate to the editor acknowledgement. Failed saves retain the draft for retry; a secret-cleanup failure after deletion remains visible on home. These stores do not form a cross-store transaction: a rejected operation can have partial writes, so it must never be presented as a successful save or deletion.

`KnockerTheme` supplies the same Android dynamic-color and appearance settings to the app and all instrumentation tests. Tests render the production `NativeApp` tree with fixture data and captured command/haptic callbacks; they no longer use Material's default pink palette. Their Android test activity is a separate host, not another frontend shipped in the APK. Release verification uses the installed, optimized app itself.

## Build and checks

Use Node 22.13+, pnpm, JDK 21 and the Android SDK requested by Gradle. Generated Android files remain excluded from source control.

```sh
pnpm install --frozen-lockfile
pnpm typecheck
pnpm --filter @workspace/knocker test
pnpm --filter @workspace/knocker exec expo prebuild --platform android --no-install
cd artifacts/knocker/android
./gradlew :knocker-native:testDebugUnitTest
./gradlew :knocker-native:connectedDebugAndroidTest
SENTRY_DISABLE_AUTO_UPLOAD=true ./gradlew assembleRelease -PreactNativeArchitectures=arm64-v8a,x86_64 \
  -Dorg.gradle.jvmargs='-Xmx6g -XX:MaxMetaspaceSize=1g' --max-workers=8
```

The release APK embeds JavaScript and requires no Metro server. The local deliverable is `builds/knocker-material3-review.apk`, with a neighboring SHA-256 file; binaries remain excluded from Git. GitHub test releases supply a direct download because T3's workspace viewer could not serve the large APK. Test APKs use the development signing key; store distribution requires production signing.

The portable suite has 54 JS behavior tests, including key/metadata write failures and hydration failures that must not erase saved data. The native JVM suite has 15 tests covering request sharing, independent batch failures, grant reconciliation and form validation. `NativeAppTest.kt` runs the real Compose/navigation tree on Android to cover late hydration, one editor title, unsaved-back protection, immediate action dispatch and distinct outcome haptic callbacks. It also checks matching acknowledgement tokens, failed-save draft retention and retry, deletion cleanup failures, saved IDs named `new`, the concise home, warning placement inside its profile panel and outside the green status section, settings access and automatic success dismissal even with a stale persistent flag. Deleted-profile routes return home instead of creating a blank draft; a deletion waits for its matching acknowledgement. All twelve device-level Compose tests passed on the Android 16 emulator. Physical haptic strength and feel require a real device.

Instrumentation tests explicitly use Espresso 3.8.0-alpha03: Compose's older transitive Espresso dependency calls a reflective InputManager API removed from Android 16. This override is confined to test dependencies.

## Controlled device validation

`node artifacts/knocker/scripts/ui-test-server.mjs` starts a loopback-only Caddy-shaped fixture. Use an HTTPS tunnel and fake keys. `/ok` succeeds, `/denied` returns 403, and paths containing `/slow/` wait eight seconds. `/slow/denied` combines the delay and failure. Returned IP `203.0.113.42` is documentation data. The fixture is not part of app runtime.

Installed-release checks passed for cold-start hydration, profile opening, one editor title, native system Back, a dirty draft retained through rotation, Keep editing, save acknowledgement and grant retention after rename. Also exercised bulk mixed success/failure, successful individual renewal, native privacy disclosure/Keep off, new-profile single-title presentation and inline validation.

Android's vibrator-service history recorded `CONTEXT_CLICK` as a tick for the bulk action, `REJECT` as a double-click for its failure result, and `CONFIRM` as a click after a successful individual knock. This verifies native dispatch, not physical motor feel. The controlled cold launch sent exactly one request per cached profile, arriving 2 ms apart; that demonstrates concurrency rather than total startup latency.

Current home captures: `minimal-home-dark.png`, `minimal-warning-dark.png`, `minimal-settings-dark.png` and `minimal-home-light.png`. The current editor capture is `minimal-editor-dark.png`; earlier Compose captures document validation and unsaved-draft workflows before the caption reduction. Native UI validation and these screenshots are recorded in PR #15. Earlier screenshots in this directory document prior builds, including the wrapper-based UI that this implementation replaces. A successful build does not establish physical haptic feel, live Caddy behavior or alarm delivery. The previous emulator's expanded Quick Settings accessibility snapshot failed repeatedly, so actual tile invocation remains a physical-device validation item; slot assignment is covered in the editor.

## References

- [Native Material cards and elevation](https://developer.android.com/develop/ui/compose/components/card)
- [Material 3 Expressive guide](https://m3.material.io/blog/building-with-m3-expressive)
- [Navigation 3 setup](https://developer.android.com/guide/navigation/navigation-3/get-started)
- [Navigation 3 releases](https://developer.android.com/jetpack/androidx/releases/navigation3)
- [Material 3 releases](https://developer.android.com/jetpack/androidx/releases/compose-material3)
- [Android action-oriented haptic feedback](https://developer.android.com/develop/ui/views/haptics/haptic-feedback)
- [Expo native view modules](https://docs.expo.dev/modules/native-view-tutorial/)
