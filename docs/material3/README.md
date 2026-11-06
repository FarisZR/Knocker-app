# Native Android Material 3 UI

Knocker uses Expo SDK 58, React Native 0.88 and `@expo/ui/jetpack-compose` on Android. The knock HTTP contract, encrypted key storage, Quick Settings tiles and native renewal scheduling are retained. Grant metadata now also records the returned IP, granted interval and local connection identity.

Android profile cards, knock/save buttons, outlined text fields, switches, tile filter chips, pinned shortcuts and snackbar feedback are actual Jetpack Compose components. Expo Router still owns native stack navigation; React Native owns the adaptive two-pane layout and editor draft/validation. Profiles and the home header appear immediately, with no entrance/reveal animation. Compose provides button ripple, press-shape morphing and brief result feedback. No animation or public-IP lookup gates a knock request or navigation.

`useColors.android.ts` reads Expo UI's Material color roles, matching the default Compose Host theme: wallpaper colors on Android 12+, a Material 3 baseline on older devices, and system light/dark appearance. Platform-specific component files keep Compose imports out of web/iOS bundles. API keys remain masked by default and use the password keyboard. Unsaved edits are protected using Expo Router's removal prevention API.

The bottom-right floating action cluster retains New profile, every pinned knock shortcut, and Knock all. It scrolls when needed. Compact grouped server rows use shape badges, emphasized type, green active containers, a draining remaining-lifetime ring in place of the active badge and an inline countdown, the whitelisted IP, a morphing loading indicator, wavy progress, and native spring transitions. All knock entry points share pending state, so pinned and bulk knocks animate the affected rows too. Error feedback stays visible until retry or dismissal.

## Startup performance and PR #14

This implementation supersedes [PR #14](https://github.com/FarisZR/Knocker-app/pull/14), including its native cached launch batching, concurrent JS fallback/manual batches, consistent pending and persistent result feedback, failed-profile retry, configuration fingerprints, package identifier (`com.fariszr.knocker`), tile component resolution and clean prebuild support. It retains SDK 58 and the native Expressive UI.

Native module creation only allocates a per-launch result holder. After the first app frame, the startup controller starts one cached Android batch on the next frame. Encrypted native storage and HTTP run on the IO pool, without waiting for JavaScript profile/key hydration, fonts, animations, permission dialogs or public-IP checks. Up to four native requests run concurrently. Repeated starts or result readers share the batch; the Expo module queue stays free while HTTP is pending.

JavaScript consumes those results and dispatches only profiles missing a matching native result. A native HTTP failure remains a result, so it is not silently sent again through JavaScript. Empty/stale caches, unavailable native modules and unsupported platforms retain concurrent JS fallback. The original batching and feedback tests from #14 are included in the portable test runner.

Fingerprints cover saved configuration and exclude grant/attempt metadata. Native store updates and JS reconciliation reject grants only when the permission target (endpoint, key or normalized IP/CIDR) changes; display and renewal-setting edits retain valid in-flight grants. A delayed batch cannot overwrite a newer attempt/grant. Native snapshot replacement preserves newer grants for matching permission targets, and queued JS writes prevent storage operations from finishing out of order. Result feedback is published before launch/bulk persistence finishes.

## Connection and IP feedback

Android reads the default connection locally using `ConnectivityManager`: Wi-Fi, cellular, Ethernet or VPN, plus an opaque network handle scoped to the device boot. This does not contact an IP service or access SSID/location. A different connection warns that the public IP **may** have changed; it cannot prove an address change on its own. A router can change its public address without changing the phone's connection.

Public-IP comparison is opt-in, **off by default**, and controlled by the home screen's `IP checks` button. The explanation names ipify before enabling. When enabled, the app asks ipify separately for IPv4 and IPv6 on resume, a connection change, and once per minute while foregrounded. Requests omit credentials, have a four-second timeout and are cancelled when disabled or backgrounded. They never send profile names, keys or server URLs, and never block a knock. CIDRs, IPv6 normalization and IPv4-mapped IPv6 are supported; missing address families and failed lookups show unknown/unavailable. Custom whitelist targets are labelled separately. Turning checks off stops lookups and clears the in-memory comparison.

Grants made by native tiles and background renewal store the same interval/IP/connection metadata. The activity merges it on resume so the ring and IP reflect native results too. A failed renewal retains an unexpired grant.

## Build

Use Node 22.13+ and pnpm, JDK 21 and the Android SDK versions requested by Gradle. From the repository root:

```sh
pnpm install --frozen-lockfile
pnpm --filter @workspace/knocker typecheck
pnpm --filter @workspace/knocker exec expo install --check
pnpm --filter @workspace/knocker exec expo prebuild --platform android --no-install
cd artifacts/knocker/android
SENTRY_DISABLE_AUTO_UPLOAD=true ./gradlew assembleRelease -PreactNativeArchitectures=arm64-v8a,x86_64 \
  -Dorg.gradle.jvmargs='-Xmx6g -XX:MaxMetaspaceSize=1g' --max-workers=8
```

The APK is `app/build/outputs/apk/release/app-release.apk`. It embeds its JavaScript bundle and needs no Metro server. The generated Expo project uses the development signing key for this test APK; store distribution requires a production signing configuration. Keep generated Android files out of source control and regenerate with prebuild so the existing local module config plugin remains authoritative.

WorkManager is updated to 2.12.0. The local module ships consumer keep rules for the Room database and renewal worker constructors used through reflection; this prevents an optimized-release cold-start crash observed during emulator testing.

## Expressive button support

`patches/@expo__ui@58.0.27.patch` switches the pinned Expo UI button wrappers to Material 3's `ButtonShapes` overload, enabling native press/release shape morphing. The app explicitly builds the `expo-ui` Gradle module from source so the patch is included rather than the published AAR. This patch can be removed when Expo UI exposes the expressive overload itself. Reduced-motion settings suppress decorative row scale and rotation.

## Controlled UI validation

`node artifacts/knocker/scripts/ui-test-server.mjs` starts a loopback-only Caddy-shaped fixture. Expose it through an HTTPS tunnel for an emulator/device: `/ok` accepts knocks, `/denied` returns a 403, and responses wait 1.4 seconds so in-flight feedback can be inspected. `/slow` waits eight seconds to validate leaving the app before the response. Use fake keys. The fixture returns the documentation IP `203.0.113.42` and is never included in the app's runtime.

## References

- [Official M3 Expressive guide](https://m3.material.io/blog/building-with-m3-expressive)
- [Expo SDK 58 release](https://expo.dev/changelog/sdk-58)
- [Expo UI Compose Host and theming](https://docs.expo.dev/versions/latest/sdk/ui/jetpack-compose/host/)
- [Expo Network API](https://docs.expo.dev/versions/latest/sdk/network/)
- [ipify API](https://www.ipify.org/)
- [Compose text field API](https://docs.expo.dev/versions/latest/sdk/ui/jetpack-compose/textfield/)

Device validation and screenshots are recorded with the pull request. A successful build alone does not establish live server, Quick Settings or background alarm behavior.

## Validation performed

The optimized, embedded-bundle APK was installed on the Pixel 7 Android 16 emulator using the shared device tools. All server interaction used the controlled fixture and fake keys.

| Scenario | Result |
| --- | --- |
| Cold start, profile load, knock on launch | Profiles appear without entrance motion; launch knock reaches the fixture |
| Individual, pinned and bulk knock | Shared pending feedback, native loading shapes and progress; successful grant turns green |
| 10/30-second grants | Ring drains against the server-granted interval, then disappears at expiry; active count and button colors reset |
| 403, retry and dismiss | Error persists with actions; retry produces new fixture requests |
| Wi-Fi to cellular, IP checks off | Local connection label changes; grant warns that IP may have changed |
| Optional public-IP checks | Off initially; explanatory Material dialog; enabling detects the fixture's deliberate address mismatch; preference survives relaunch; disabling clears comparison |
| Editor | Masked key, HTTPS validation, save, native switches/chips, occupied tile slot, unsaved-change protection and delete/cancel exercised |
| System configuration | Light/dark palette and extra-large text; navigation remains functional after font configuration changes |
| Release runtime | No AndroidRuntime or ReactNativeJS errors during the final installed-build session |
| Cached native startup | Two profiles sent exactly once per cold launch, with native dispatch confirmed by `KnockerLaunch` logs; fixture requests arrived 6 ms apart on the first run and 8 ms apart on the second |
| Leave app while startup is pending | Back left the new app at 15:25:27 UTC; the slow response completed at 15:25:32; returning displayed the native grant/ring/IP without a new startup batch |
| Launch retry | Retried only the denied profile; the successful slow profile received no extra request |

Automated validation passed: workspace typechecking, all 20 Expo Doctor checks, Expo dependency compatibility, web export, and 24 tests covering grant expiry/fractions, IP privacy/comparison, immediate concurrent dispatch, startup bridge idempotence, native fallback and configuration-safe result merging.

The arrival gaps above verify concurrent requests in the controlled test, not total app startup latency. The eight-second server delay is intentional fixture behavior. These checks used the rebuilt `com.fariszr.knocker` release APK after the PR #14 integration.

Physical-device haptics, a live Caddy deployment and background alarm delivery still need device validation. Quick Settings slot assignment was exercised in the editor, but actual tile invocation was not verified: the emulator's expanded Quick Settings panel repeatedly failed accessibility snapshots (`mw537c6k-75ad8959`), so that test path was stopped.

## CodeRabbit follow-up

The review fixes coordinate all Android request sources (launch, tiles, renewal workers and foreground actions) through one per-profile/HTTP-input future registry. Native pending-state events feed the shared UI state, and the foreground bridge consumes the same result rather than sending a competing fetch. Nine JVM tests cover shared futures, independent dispatch, retries, edited-profile grant reconciliation and partially failed startup batches; run them with `./gradlew :knocker-native:testDebugUnitTest` in the generated Android directory. The JavaScript suite now has 48 tests.

Grant ordering uses server grant start time before expiry, with a recording timestamp to distinguish same-second grants. Both native and JS profile synchronization preserve newer grant metadata for the same endpoint/key/normalized target. Changing that target clears grant and attempt metadata; display and renewal-setting edits preserve it. Missing grant duration falls back to receipt time. JS HTTP fallback results never await local connection sampling, and native identity reads are bounded.

Native HTTP opens its connection on the captured Android `Network`. Local identity includes transport state and a conservative non-VPN topology signal to detect VPN transport changes without SSID/location access or public-IP lookups. Expo Network supplies offline/reconnect/transport fallback identity when the custom module is absent. Real VPN handover remains a physical-device validation item.

UI fixes retain modal editor drafts through widening/rotation, refresh clean embedded editors after saved configuration changes, reconcile normalized native text after every edit, restore selected-slot toggling, show generic-card renewal errors and shared pending state, and keep snackbar actions inside the available height. Android floating actions remain in the list pane on wide layouts so they do not cover editor fields.

Device follow-up covered blank TTL plus rejected nonnumeric input, slot clear/reselect, dirty rotation and Keep editing, saving back into the wide editor with the saved name, preserving the active grant on rename, and clearing grant/IP feedback after endpoint changes. Release assembly and signature verification passed. The current local deliverable is `builds/knocker-material3-review.apk` (excluded from Git), with a neighboring SHA-256 file.

## Second review follow-up

Successful in-flight grants survive renaming, pinning, slot changes and TTL/renewal edits. Native persistence applies them to the latest saved profile and schedules renewal from its current settings. Results carry a separate permission-target fingerprint, and the shared request registry keys only HTTP inputs, so display edits neither lose grants nor create duplicate requests. Both JS merge paths retain the status and error of a later failed attempt while still recovering a valid earlier grant.

Each native launch future settles independently. An exceptional request becomes an explicit failure result, preserving successful siblings and preventing automatic JS fallback for a request that was already dispatched. Android floating actions stay hidden during profile hydration, and profile mutation APIs reject pre-hydration writes. This does not delay the independent cached native startup batch.

The Android package ID is deliberately `com.fariszr.knocker`, matching PR #14. The previous ID was `dev.faris.knocker`; this is a separate installation under the authorized hard cutover, with no profile migration. It does not update an existing installation using the previous ID.

Production functions touched by this PR now document their contracts and timing/persistence invariants for the requested docstring coverage check.


Second-round validation passed: 48 JS tests, 9 native JVM tests, workspace typechecking, release assembly and APK signature verification. The rebuilt APK was installed and cold-launched on the Android 16 emulator. The fixture recorded exactly one request for each startup profile, 27 ms apart; the successful profile retained its ring, IP and grant after saving the renamed draft. Final runtime logs contained no AndroidRuntime or ReactNativeJS errors. The save completed after the slow response, so the device rename-in-flight timing test was inconclusive because the Save selector failed; the exact timing regression is covered by JS and JVM tests. See `screenshots/review-grant-after-rename.png` for the resulting release UI.


## Loading-state contrast fix

The pending card used `primaryContainer` while its text still used the active green or generic surface foreground. It now uses the content role paired with the visible container for the name, endpoint, IP details and supporting labels. An existing active grant keeps its green container during renewal. Spinner and progress colors follow their actual background, and pending card/pinned/bulk buttons provide explicit readable disabled colors while remaining non-interactive. Removing the redundant animated inner background keeps container and text changes together and adds no request delay.

Validation: mobile typechecking, optimized release assembly, APK signature verification and emulator installation passed. On Android 16, checked an initial dark-theme knock, an active dark-theme renewal, and initial/active knocks together in the light theme. Loading labels and controls remained readable, and the successful response restored the grant ring. No AndroidRuntime or ReactNativeJS errors appeared in the installed-build session. Captures: `pending-contrast-dark.png`, `renewal-contrast-dark.png`, and `pending-contrast-light.png` under `screenshots/`.
