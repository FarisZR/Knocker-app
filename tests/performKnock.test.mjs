import test from "node:test";
import assert from "node:assert/strict";
import { loadTypeScript } from "./load-typescript.mjs";
const profile = {
  id: "home",
  endpointUrl: "https://example.test",
  apiKey: "key",
  ipOverride: null,
};
const load = (native, send) =>
  loadTypeScript(new URL("../lib/performKnock.ts", import.meta.url), {
    "knocker-native": {
      knockProfileNative: native,
      getNetworkIdentity: () => new Promise(() => {}),
    },
    "expo-network": {},
    "./knock": { knock: send },
  });
test("a completed HTTP fallback never waits for an unresolved network identity lookup", async () => {
  const { performKnock } = load(
    async () => null,
    async () => ({ ok: true, expiresAt: 10000, expiresInSeconds: 0 }),
  );
  let finished = false;
  const request = performKnock(profile).then((result) => {
    finished = true;
    return result;
  });
  await new Promise(setImmediate);
  assert.equal(finished, true);
  assert.equal((await request).grantNetworkId, null);
});
test("native success uses the bound connection metadata without issuing a JS request", async () => {
  let sends = 0;
  const { performKnock } = load(
    async () => ({
      ok: true,
      expiresAtMillis: 5000,
      whitelistedAtMillis: 1000,
      completedAtMillis: 1100,
      grantNetworkId: "bound",
      grantNetworkType: "Wi-Fi",
      whitelistedEntry: "203.0.113.42",
    }),
    async () => {
      sends++;
    },
  );
  const result = await performKnock(profile);
  assert.equal(result.grantNetworkId, "bound");
  assert.equal(result.whitelistedAt, 1000);
  assert.equal(sends, 0);
});
test("a native failure is not repeated through JS fetch", async () => {
  let sends = 0;
  const { performKnock } = load(
    async () => ({ ok: false, message: "denied" }),
    async () => {
      sends++;
    },
  );
  assert.equal((await performKnock(profile)).ok, false);
  assert.equal(sends, 0);
});
