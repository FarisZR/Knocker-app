# Native Android Material 3 UI

Knocker uses Expo SDK 58, React Native 0.88 and `@expo/ui/jetpack-compose` on Android. The knock HTTP contract, encrypted key storage, Quick Settings tiles and native renewal scheduling are retained. Grant metadata now also records the returned IP, granted interval and local connection identity.

Android profile cards, knock/save buttons, outlined text fields, switches, tile filter chips, pinned shortcuts and snackbar feedback are actual Jetpack Compose components. Expo Router still owns native stack navigation; React Native owns the adaptive two-pane layout and editor draft/validation. Profiles and the home header appear immediately, with no entrance/reveal animation. Compose provides button ripple, press-shape morphing and brief result feedback. No animation or public-IP lookup gates a knock request or navigation.

`useColors.android.ts` reads Expo UI's Material color roles, matching the default Compose Host theme: wallpaper colors on Android 12+, a Material 3 baseline on older devices, and system light/dark appearance. Platform-specific component files keep Compose imports out of web/iOS bundles. API keys remain masked by default and use the password keyboard. Unsaved edits are protected using Expo Router's removal prevention API.

The bottom-right floating action cluster retains New profile, every pinned knock shortcut, and Knock all. It scrolls when needed. Compact grouped server rows use shape badges, emphasized type, green active containers, a draining remaining-lifetime ring in place of the active badge and an inline countdown, the whitelisted IP, a morphing loading indicator, wavy progress, and native spring transitions. All knock entry points share pending state, so pinned and bulk knocks animate the affected rows too. Error feedback stays visible until retry or dismissal.

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

`node artifacts/knocker/scripts/ui-test-server.mjs` starts a loopback-only Caddy-shaped fixture. Expose it through an HTTPS tunnel for an emulator/device: `/ok` accepts knocks, `/denied` returns a 403, and responses wait 1.4 seconds so in-flight feedback can be inspected. Use fake keys. The fixture returns the documentation IP `203.0.113.42` and is never included in the app's runtime.

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

Automated validation passed: workspace typechecking, all 20 Expo Doctor checks, Expo dependency compatibility, web export, and 10 tests covering grant expiry/fractions, address-family normalization, CIDRs, unavailable families and the opt-out request guard.

Physical-device haptics, a live Caddy deployment and background alarm delivery still need device validation. Quick Settings slot assignment was exercised in the editor, but actual tile invocation was not verified: the emulator's expanded Quick Settings panel repeatedly failed accessibility snapshots (`mw537c6k-75ad8959`), so that test path was stopped.
