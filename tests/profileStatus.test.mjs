import { loadTypeScript } from "./load-typescript.mjs";
const { isWhitelisted, grantRemainingFraction } = loadTypeScript(
  new URL("../lib/profileStatus.ts", import.meta.url),
);
import { test } from "node:test";
import assert from "node:assert/strict";

test("failed renewal retains a still-valid grant", () => {
  const profile = { lastKnockStatus: "error", expiresAt: 2000 };
  assert.equal(isWhitelisted(profile, 1000), true);
});
test("expiry supplied by a native tile activates an otherwise idle JS profile", () => {
  const profile = { lastKnockStatus: "idle", expiresAt: 2000 };
  assert.equal(isWhitelisted(profile, 1000), true);
});
test("grant expires at its exact deadline", () => {
  assert.equal(isWhitelisted({ expiresAt: 1000 }, 999), true);
  assert.equal(isWhitelisted({ expiresAt: 1000 }, 1000), false);
  assert.equal(isWhitelisted({ expiresAt: 1000 }, 1001), false);
});
test("missing expiry never implies access", () => {
  assert.equal(isWhitelisted({ expiresAt: null }, 1000), false);
});

test("remaining lifetime uses the granted interval and clamps at both ends", () => {
  const grant = { whitelistedAt: 1000, expiresAt: 5000 };
  assert.equal(grantRemainingFraction(grant, 3000), 0.5);
  assert.equal(grantRemainingFraction(grant, 0), 1);
  assert.equal(grantRemainingFraction(grant, 5000), 0);
  assert.equal(grantRemainingFraction(grant, 6000), 0);
  assert.equal(grantRemainingFraction({ expiresAt: 5000 }, 3000), null);
  assert.equal(
    grantRemainingFraction({ expiresAt: 1000, whitelistedAt: 1000 }, 0),
    null,
  );
});

test("a reversed grant interval has no remaining fraction", () => {
  assert.equal(
    grantRemainingFraction({ expiresAt: 1000, whitelistedAt: 2000 }, 1500),
    null,
  );
});
