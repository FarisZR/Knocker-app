# Android builds and Google Play publishing

Related: [launch tracking issue #5](https://github.com/FarisZR/Knocker-app/issues/5).

## Builds

**Android CI and release** runs on pushes to `main`, pull requests, published GitHub releases, and manual dispatch. Feature-branch pushes use the PR run instead of building the same commit twice; use a manual dispatch for a signed build of an unmerged branch. It installs the frozen pnpm lockfile, runs all Knocker JS tests and workspace typechecks, generates Android from Expo configuration, runs native JVM tests, compiles the instrumentation tests, and builds release APK + AAB with embedded Hermes JavaScript. Compilation does not run device tests; complete the [background QA checklist](../artifacts/knocker/modules/knocker-native/README.md#background-release-qa) separately.

Pushes, releases and manual runs use the production upload certificate. PRs build with the development certificate, have source-map uploads disabled, and never publish. Fork PRs need no credentials. Release APKs attach to the GitHub release. APKs are also Actions artifacts for 14 days; signed AABs stay in Actions for 7 days and are never attached to the public release. Actions artifacts are **not secret storage**: on this public repository, signed-in users with repository read access can download them. Signing passwords, private keys and auth tokens are never artifacts.

The workflow verifies APK and AAB signatures against the supplied upload certificate, APK 16 KB ZIP alignment, archive integrity, and embedded JavaScript. This does not replace Play's AAB validation, generated-APK ELF alignment checks, pre-launch reports or real-device QA. PR builds include ARM64 only to reduce native compilation; signed builds on `main`, releases and manual dispatches include ARM64, ARMv7 and x86_64.

Both Gradle invocations enable the task-output build cache. Gradle state is saved for subsequent runs, including updates to the same PR (GitHub isolates PR cache writes from `main`). React Native's CMake build also uses a persistent, size-limited ccache for native compiler outputs, keyed by the lockfile with a fresh snapshot per run. Only compiler outputs are stored there; generated Android projects, signing keys and packaged artifacts are not cached. The build logs include cache hit statistics. A new lockfile starts a cold compiler cache; speedups depend on warm caches and which sources changed. Superseded CI runs are cancelled, while release and Play-publishing runs remain serialized and are never cancelled by a newer run.

Version names come from `v1.0.0`/`v1.0.0-beta.1` release tags, the manual version input, or `app.json`. Version codes are **1,000,000 + workflow run number**, increasing across this workflow's push/release/manual runs. Re-runs keep their version code; start a new run for a new Play upload. Do not rename/recreate the workflow without preserving this sequence, or manually upload a larger code without adjusting the offset. Native Sentry and JS source maps use the generated application ID/version/code automatically.

## Repository secrets

| Secret | Value |
| --- | --- |
| `KEYSTORE_BASE64` | Base64 of Proton Pass `fzr-upload-keystore.p12` |
| `STORE_PASSWORD` | Keystore password |
| `KEY_ALIAS` | `fzr-upload` |
| `KEY_PASSWORD` | Private-key password |
| `SENTRY_AUTH_TOKEN` | Token authorized to upload source maps to `fariszr/knocker-app` |
| `PLAY_SERVICE_ACCOUNT_JSON` | Google service-account key JSON with access to `com.fariszr.knocker` in Play Console |

Signed builds fail if signing or Sentry upload credentials are missing, or source-map uploads fail. Sentry's public DSN is already configured in the app; `sendDefaultPii` and log collection remain disabled. The auth token is only a build credential, never an app runtime variable. CI builds use Sentry environment `ci`, published releases and dispatch submissions use `production`.

## Privacy policy and crash reports

The public privacy policy lives in [`remal-net/terms.remal.org`](https://github.com/remal-net/terms.remal.org) (`content/knocker/privacy-policy.md`) and is served at **https://terms.remal.org/knocker/privacy-policy/**. Use that URL for the Play listing; the app links to the same address under **Settings → About** (`PRIVACY_POLICY_URL` in `AboutInfo.kt`). Change the policy and the app together: it states what Sentry receives, the 30-day retention of the current Sentry plan, and that the app opts out of Android backup.

**Settings → Crash reports** turns Sentry off. Reporting is on by default. `Sentry.init` runs only when the stored choice allows it (`isDiagnosticsEnabled()` in `app/_layout.tsx`); the native SDK has `io.sentry.auto-init=false`, so no Sentry code starts otherwise. Turning it off also calls `Sentry.close()`; turning it on applies after a restart. Server-side, keep **Prevent Storing of IP Addresses** and data scrubbing enabled for the organization, since the policy says they are.

## First Play upload (one time)

1. Create/finish the Play Console app for `com.fariszr.knocker`; enable Play App Signing using this upload certificate. Download the signed AAB artifact from a successful Actions run and perform the **first upload manually**. Google requires this before API submissions. See [Expo's first-upload guide](https://docs.expo.dev/submit/android-manual/).
2. Enable the [Google Play Android Developer API](https://developers.google.com/android-publisher/getting_started), create a service account and grant it access to this app, including release permissions for the intended tracks. Store its JSON as `PLAY_SERVICE_ACCOUNT_JSON`.
3. Complete the privacy policy, Data safety, store listing, app access/reviewer instructions and required account/testing/review steps in issue #5. Automation cannot bypass Google's review or production-access requirements.
4. Run the workflow from **main** with `publish=true`, version name, 1–500 character English changelog, track `internal`, status `draft`. Confirm the bundle/version/notes in Console. A draft app may only accept draft releases.
5. When eligible, use status `completed` to submit a release. Google review and managed publishing settings still determine when it becomes visible.

## Paste a changelog and publish

After merging this workflow, open **Actions → Android CI and release → Run workflow**, select main, enter the version and changelog, enable **publish**, and select track/status. No release-tag maintenance is required. The same tested AAB is passed to the publishing job; it is not rebuilt. `google-play` is the deployment environment; optional GitHub environment reviewers can protect production access.

For automatic submission on a **published GitHub release**, set repository variables:

| Variable | Value |
| --- | --- |
| `PLAY_PUBLISH_ENABLED` | `true` to submit on release publication; unset means build only |
| `PLAY_TRACK` | `internal` initially; `production` once eligible |
| `PLAY_RELEASE_STATUS` | `draft` initially; `completed` when ready for submission |
| `PLAY_CHANGES_NOT_SENT_FOR_REVIEW` | Optional `true` for accounts requiring explicit review submission in Console |

Use a semantic version tag and put **only the Play changelog (1–500 characters)** in the GitHub release body when auto publishing is enabled. Notes are passed as data, never interpolated into shell commands. Submission failures leave the AAB available for manual upload. For an already uploaded version, promote it in Console instead of attempting to upload the same version code again. Publishing workflows share a concurrency group, and the submission job rejects older runs if a newer run has already published successfully. Play requires increasing codes.

## Local reproduction

Install pnpm 10.28.2, Node 22, Java 21 and the Android SDK. Run `pnpm install --frozen-lockfile`, `pnpm --filter @workspace/knocker test`, `pnpm typecheck`, and `pnpm --filter @workspace/knocker android:prebuild`. In `artifacts/knocker/android`, run `./gradlew :knocker-native:testDebugUnitTest :knocker-native:compileDebugAndroidTestKotlin :app:assembleRelease :app:bundleRelease -PreactNativeArchitectures=arm64-v8a,armeabi-v7a,x86_64`.

For production signing export `KNOCKER_SIGN_RELEASE=true`, absolute `KNOCKER_KEYSTORE_PATH`, `STORE_PASSWORD`, `KEY_ALIAS`, `KEY_PASSWORD`, `SENTRY_AUTH_TOKEN`, `KNOCKER_VERSION_NAME` and `KNOCKER_VERSION_CODE` **before prebuild**. The generated Gradle script reads signing credentials from the environment, not a checked-in properties file. Never commit native build output or credentials.
