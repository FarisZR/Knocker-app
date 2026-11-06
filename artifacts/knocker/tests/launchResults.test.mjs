import test from "node:test";
import assert from "node:assert/strict";
import { loadTypeScript } from "./load-typescript.mjs";
const { nativeConfigurationFingerprint: fingerprint } = loadTypeScript(
  new URL("../lib/profileConfiguration.ts", import.meta.url),
);
const { selectLaunchResults, applyLaunchResults, mergeExpiryFromNative } =
  loadTypeScript(new URL("../lib/launchResults.ts", import.meta.url));
const profile = {
  id: "home",
  name: "Home",
  endpointUrl: "https://example.test",
  apiKey: "fake-key",
  ttlSeconds: 300,
  ipOverride: null,
  knockOnOpen: true,
  autoRenew: false,
  autoRenewSafetyWindowSec: 30,
  pinnedToHome: true,
  tileSlot: 1,
  lastKnockStatus: "idle",
  lastKnockAt: null,
  lastError: null,
  expiresAt: null,
  whitelistedAt: null,
  whitelistedEntry: null,
  grantNetworkId: null,
  grantNetworkType: null,
};
const result = {
  profileId: profile.id,
  name: profile.name,
  ok: true,
  message: null,
  whitelistedEntry: "203.0.113.42",
  expiresAtMillis: 301000,
  expiresInSeconds: 300,
  requestedTtlSeconds: 300,
  ttlCapped: false,
  configurationFingerprint: fingerprint(profile),
  whitelistedAtMillis: 1000,
  grantNetworkId: "boot:network",
  grantNetworkType: "Wi-Fi",
  completedAtMillis: 2000,
};

test("configuration fingerprint covers every saved setting, excluding result metadata", () => {
  for (const [key, value] of Object.entries({
    id: "new",
    name: "Renamed",
    endpointUrl: "https://other.test",
    apiKey: "new-key",
    ttlSeconds: 60,
    ipOverride: "198.51.100.1",
    knockOnOpen: false,
    autoRenew: true,
    autoRenewSafetyWindowSec: 45,
    pinnedToHome: false,
    tileSlot: 2,
  })) {
    assert.notEqual(
      fingerprint({ ...profile, [key]: value }),
      fingerprint(profile),
      key,
    );
  }
  assert.equal(
    fingerprint({
      ...profile,
      expiresAt: 30000,
      whitelistedAt: 10000,
      whitelistedEntry: "203.0.113.42",
      grantNetworkId: "changed",
      lastKnockStatus: "success",
      lastKnockAt: 10000,
    }),
    fingerprint(profile),
  );
});
test("only missing or stale native profiles need JS fallback; matching failures do not duplicate HTTP", () => {
  const missing = { ...profile, id: "new-profile" };
  const failure = { ...result, ok: false, message: "Denied" };
  const selected = selectLaunchResults([profile, missing], [failure]);
  assert.deepEqual(selected.matching, [failure]);
  assert.deepEqual(selected.missing, [missing]);
  const changed = { ...profile, apiKey: "rotated" };
  assert.deepEqual(selectLaunchResults([changed], [result]).missing, [changed]);
});
test("launch results populate the remaining-time ring, returned IP and local network", () => {
  const [merged] = applyLaunchResults([profile], [result]);
  assert.equal(merged.expiresAt, 301000);
  assert.equal(merged.whitelistedAt, 1000);
  assert.equal(merged.whitelistedEntry, "203.0.113.42");
  assert.equal(merged.grantNetworkId, "boot:network");
  assert.equal(merged.lastKnockStatus, "success");
});
test("removed, disabled, edited profiles and newer attempts reject old launch results", () => {
  assert.deepEqual(applyLaunchResults([], [result]), []);
  for (const current of [
    { ...profile, knockOnOpen: false },
    { ...profile, endpointUrl: "https://changed.test" },
    { ...profile, lastKnockAt: 5000, lastKnockStatus: "error" },
  ]) {
    assert.equal(applyLaunchResults([current], [result])[0], current);
  }
});
test("native snapshot merges require the same configuration and retain all grant metadata", () => {
  const snapshot = {
    ...profile,
    expiresAt: result.expiresAtMillis,
    whitelistedAt: result.whitelistedAtMillis,
    whitelistedEntry: result.whitelistedEntry,
    grantNetworkId: result.grantNetworkId,
    grantNetworkType: result.grantNetworkType,
    configurationFingerprint: fingerprint(profile),
  };
  assert.equal(
    mergeExpiryFromNative([profile], [snapshot])[0].whitelistedEntry,
    result.whitelistedEntry,
  );
  const changed = { ...profile, apiKey: "rotated" };
  assert.equal(mergeExpiryFromNative([changed], [snapshot])[0], changed);
});
test("failed launch renewal preserves a still-valid grant", () => {
  const current = { ...profile, expiresAt: 10000, whitelistedAt: 1000 };
  const [merged] = applyLaunchResults(
    [current],
    [{ ...result, ok: false, message: "403 denied" }],
  );
  assert.equal(merged.expiresAt, 10000);
  assert.equal(merged.lastKnockStatus, "error");
});

test("an earlier launch result cannot overwrite a newer grant merged from a tile or renewal", () => {
  const newer = {
    ...profile,
    whitelistedAt: 5000,
    expiresAt: 305000,
    whitelistedEntry: "198.51.100.1",
  };
  assert.equal(applyLaunchResults([newer], [result])[0], newer);
});
