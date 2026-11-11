# Knocker

Knocker is an Expo / React Native app for managing Caddy Knocker profiles, sending knocks, and renewing access. Android features include native screens, Quick Settings tiles, and background renewal through the local `modules/knocker-native` Expo module.

Use Node.js 22 and pnpm 10.28.2. Run all commands from this repository's root:

```sh
pnpm install --frozen-lockfile
pnpm dev
```

Use `pnpm android` or `pnpm ios` for a native development build (requires the platform SDK), or `pnpm web` for web development. Native Android features require a native build.

```sh
pnpm test       # App and release tooling tests
pnpm typecheck
pnpm build      # Export production JavaScript and assets for Android, iOS, and web
```

`pnpm android:prebuild` generates the ignored `android/` project. For local release packaging, install Java 21 and the Android SDK, then run:

```sh
KNOCKER_ALLOW_DEBUG_SIGNING=true SENTRY_DISABLE_AUTO_UPLOAD=true pnpm android:apk
```

Production signing, Sentry uploads, GitHub releases, and Google Play publishing are documented in [Android releases](docs/android-release.md). See [native module documentation](modules/knocker-native/README.md) for background behavior and device QA, and [the Caddy Knocker API reference](docs/caddy-knocker-api.md) for the external server protocol.

The app connects to the endpoints configured in its profiles; this repository does not need a separate API server or database.
