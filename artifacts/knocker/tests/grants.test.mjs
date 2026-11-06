import test from "node:test";
import assert from "node:assert/strict";
import { loadTypeScript } from "./load-typescript.mjs";
const {
  prepareProfileSave,
  isNewerGrant,
  grantStart,
  mergeGrantsForSave,
  applyKnockResult,
} = loadTypeScript(new URL("../lib/grants.ts", import.meta.url));
const { mergeExpiryFromNative } = loadTypeScript(
  new URL("../lib/launchResults.ts", import.meta.url),
);
const { nativeConfigurationFingerprint } = loadTypeScript(
  new URL("../lib/profileConfiguration.ts", import.meta.url),
);
const profile = {
  id: "home",
  name: "Home",
  endpointUrl: "https://example.test",
  apiKey: "key",
  ipOverride: null,
  knockOnOpen: true,
  expiresAt: 10000,
  whitelistedAt: 1000,
  grantRecordedAt: 1100,
  whitelistedEntry: "203.0.113.42",
  grantNetworkId: "wifi",
  grantNetworkType: "Wi-Fi",
  lastKnockStatus: "success",
  lastKnockAt: 1100,
  lastError: null,
};

test("changing endpoint, key or IP target clears the complete grant and attempt state", () => {
  for (const patch of [
    { endpointUrl: "https://other.test" },
    { apiKey: "new-key" },
    { ipOverride: "198.51.100.1" },
  ]) {
    const saved = prepareProfileSave({ ...profile, ...patch }, profile);
    for (const field of [
      "expiresAt",
      "whitelistedAt",
      "grantRecordedAt",
      "whitelistedEntry",
      "grantNetworkId",
      "grantNetworkType",
      "lastKnockAt",
      "lastError",
    ])
      assert.equal(saved[field], null, field);
    assert.equal(saved.lastKnockStatus, "idle");
  }
});
test("display, TTL and access settings retain the latest existing grant", () => {
  const saved = prepareProfileSave(
    {
      ...profile,
      name: "Renamed",
      pinnedToHome: true,
      ttlSeconds: 60,
      expiresAt: 1,
    },
    profile,
  );
  assert.equal(saved.expiresAt, profile.expiresAt);
  assert.equal(saved.whitelistedEntry, profile.whitelistedEntry);
});
test("equivalent IPv6 and CIDR spellings do not invalidate grants", () => {
  for (const [before, after] of [
    ["2001:db8::1", "2001:0db8:0:0:0:0:0:1"],
    ["203.0.113.42/24", "203.0.113.0/24"],
    ["::ffff:203.0.113.42", "203.0.113.42"],
  ]) {
    assert.equal(
      prepareProfileSave(
        { ...profile, ipOverride: after },
        { ...profile, ipOverride: before },
      ).expiresAt,
      profile.expiresAt,
    );
  }
});
test("older native grant cannot replace a newer JS grant even with a later expiry", () => {
  const current = { ...profile, whitelistedAt: 5000, expiresAt: 8000 };
  const older = {
    ...profile,
    expiresAt: 50000,
    configurationFingerprint: nativeConfigurationFingerprint(current),
  };
  assert.equal(isNewerGrant(older, current), false);
  assert.equal(mergeExpiryFromNative([current], [older])[0], current);
});
test("recording timestamps order same-second grants without relying on expiry", () => {
  const cached = {
    ...profile,
    grantRecordedAt: 1200,
    whitelistedEntry: "198.51.100.1",
  };
  assert.equal(isNewerGrant(cached, profile), true);
  assert.equal(isNewerGrant(profile, cached), false);
});
test("saving a pin change preserves a newer native grant, but a new target does not import it", () => {
  const renamed = { ...profile, name: "Renamed", pinnedToHome: true };
  const cached = {
    ...profile,
    whitelistedAt: 2000,
    expiresAt: 11000,
    whitelistedEntry: "198.51.100.1",
  };
  const [saved] = mergeGrantsForSave([renamed], [cached]);
  assert.equal(saved.name, "Renamed");
  assert.equal(saved.whitelistedEntry, cached.whitelistedEntry);
  const changed = { ...renamed, endpointUrl: "https://different.test" };
  assert.equal(mergeGrantsForSave([changed], [cached])[0], changed);
});
test("missing, zero and invalid duration use receipt time so the remaining-time ring can drain", () => {
  for (const duration of [null, 0, -1, NaN])
    assert.equal(grantStart(10000, duration, 2000), 2000);
  assert.equal(grantStart(10000, 5, 2000), 5000);
});

const completed = {
  ok: true,
  expiresAt: 22000,
  expiresInSeconds: 20,
  whitelistedAt: 2000,
  completedAtMillis: 2100,
  whitelistedEntry: "198.51.100.1",
  grantNetworkId: "cellular",
};
test("an in-flight success survives rename, pin, TTL and renewal edits", () => {
  const edited = {
    ...profile,
    name: "Renamed",
    pinnedToHome: true,
    ttlSeconds: 60,
    autoRenew: true,
  };
  const saved = applyKnockResult(edited, profile, completed);
  assert.equal(saved.name, edited.name);
  assert.equal(saved.pinnedToHome, true);
  assert.equal(saved.autoRenew, true);
  assert.equal(saved.ttlSeconds, 60);
  assert.equal(saved.expiresAt, completed.expiresAt);
  assert.equal(saved.grantRecordedAt, completed.completedAtMillis);
});
test("in-flight successes cannot import grants into changed HTTP targets", () => {
  for (const patch of [
    { endpointUrl: "https://other.test" },
    { apiKey: "rotated" },
    { ipOverride: "203.0.113.1" },
  ]) {
    const changed = { ...profile, ...patch };
    assert.equal(applyKnockResult(changed, profile, completed), changed);
  }
});
test("an earlier success preserves a newer grant and a later failure", () => {
  const current = {
    ...profile,
    expiresAt: 10000,
    whitelistedAt: 5000,
    grantRecordedAt: 5100,
    lastKnockAt: 6000,
    lastKnockStatus: "error",
    lastError: "Network timeout",
  };
  assert.equal(applyKnockResult(current, profile, completed), current);
});
test("a valid grant is retained without erasing feedback from a later failed attempt", () => {
  const current = {
    ...profile,
    lastKnockAt: 3000,
    lastKnockStatus: "error",
    lastError: "Denied",
  };
  const saved = applyKnockResult(current, profile, completed);
  assert.equal(saved.expiresAt, completed.expiresAt);
  assert.equal(saved.lastKnockAt, 3000);
  assert.equal(saved.lastKnockStatus, "error");
  assert.equal(saved.lastError, "Denied");
});
test("both native merge paths preserve a JS failure newer than grant receipt", () => {
  const current = {
    ...profile,
    lastKnockAt: 3000,
    lastKnockStatus: "error",
    lastError: "Denied",
  };
  const cached = {
    ...profile,
    whitelistedAt: 2000,
    grantRecordedAt: 2100,
    expiresAt: 22000,
  };
  for (const merge of [mergeGrantsForSave, mergeExpiryFromNative]) {
    const [merged] = merge([current], [cached]);
    assert.equal(merged.expiresAt, 22000);
    assert.equal(merged.lastKnockStatus, "error");
    assert.equal(merged.lastError, "Denied");
    assert.equal(merged.lastKnockAt, 3000);
  }
});
