#!/usr/bin/env bash
set -euo pipefail
app=artifacts/knocker/android/app/build/outputs
apk="$app/apk/release/app-release.apk"
aab="$app/bundle/release/app-release.aab"
build_tools=$(find "${ANDROID_HOME:?}/build-tools" -mindepth 1 -maxdepth 1 -type d | sort -V | tail -1)
"$build_tools/apksigner" verify --verbose --print-certs "$apk"
"$build_tools/zipalign" -c -P 16 -v 4 "$apk"
unzip -t "$aab" >/dev/null
unzip -l "$apk" | awk '{print $4}' > /tmp/knocker-apk-entries
unzip -l "$aab" | awk '{print $4}' > /tmp/knocker-aab-entries
rg '^assets/index.android.bundle$' /tmp/knocker-apk-entries
rg '^base/assets/index.android.bundle$' /tmp/knocker-aab-entries
jarsigner -verify "$aab" > /tmp/knocker-aab-signature
rg 'jar verified' /tmp/knocker-aab-signature
if [ "${KNOCKER_SIGN_RELEASE:-false}" = true ]; then
  # Compare certificates with the supplied upload key, not merely any valid signature.
  keytool -exportcert -keystore "$KNOCKER_KEYSTORE_PATH" -storepass:env STORE_PASSWORD -alias "$KEY_ALIAS" -file /tmp/knocker-upload-cert.der
  expected=$(sha256sum /tmp/knocker-upload-cert.der | cut -d ' ' -f1)
  "$build_tools/apksigner" verify --print-certs "$apk" | tr '[:upper:]' '[:lower:]' | rg -F "$expected"
  keytool -printcert -jarfile "$aab" | tr -d ':' | tr '[:upper:]' '[:lower:]' | rg -F "$expected"
fi
