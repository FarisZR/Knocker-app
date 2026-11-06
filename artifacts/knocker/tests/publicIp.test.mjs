import { test } from "node:test";
import assert from "node:assert/strict";
import { loadTypeScript } from "./load-typescript.mjs";
const { compareGrantAddress, lookupPublicAddresses } = loadTypeScript(
  new URL("../lib/publicIp.ts", import.meta.url),
);

test("normalizes IPv6 and IPv4-mapped addresses", () => {
  assert.equal(
    compareGrantAddress("2001:0db8:0000:0000::1", { ipv6: "2001:db8::1" }),
    "same",
  );
  assert.equal(
    compareGrantAddress("::ffff:203.0.113.42", { ipv4: "203.0.113.42" }),
    "same",
  );
  assert.equal(
    compareGrantAddress("203.0.113.42", { ipv4: "203.0.113.43" }),
    "changed",
  );
});
test("compares the correct family and never infers a change from missing data", () => {
  for (const entry of [null, "", "bad", "2001:db8::1"]) {
    assert.equal(
      compareGrantAddress(entry, { ipv4: "203.0.113.42" }),
      "unknown",
    );
  }
  assert.equal(compareGrantAddress("203.0.113.42", {}), "unknown");
});
test("compares server-returned IPv4, IPv6 and mapped CIDRs", () => {
  assert.equal(
    compareGrantAddress("203.0.113.0/24", { ipv4: "203.0.113.42" }),
    "same",
  );
  assert.equal(
    compareGrantAddress("203.0.113.0/24", { ipv4: "198.51.100.1" }),
    "changed",
  );
  assert.equal(
    compareGrantAddress("2001:db8::/32", { ipv6: "2001:db8:abcd::1" }),
    "same",
  );
  assert.equal(
    compareGrantAddress("::ffff:203.0.113.0/120", { ipv4: "203.0.113.42" }),
    "same",
  );
});
test("disabled and already-aborted checks make zero external requests", async () => {
  let calls = 0;
  const request = async () => {
    calls++;
    throw new Error("must not call");
  };
  const controller = new AbortController();
  assert.deepEqual(
    await lookupPublicAddresses(false, controller.signal, request),
    {},
  );
  controller.abort();
  assert.deepEqual(
    await lookupPublicAddresses(true, controller.signal, request),
    {},
  );
  assert.equal(calls, 0);
});
test("enabled checks omit credentials and tolerate unavailable IPv6", async () => {
  const calls = [];
  const result = await lookupPublicAddresses(
    true,
    new AbortController().signal,
    async (url, options) => {
      calls.push([url, options]);
      if (url.includes("api6")) throw new Error("no IPv6");
      return { ok: true, json: async () => ({ ip: "203.0.113.42" }) };
    },
  );
  assert.deepEqual(result, { ipv4: "203.0.113.42" });
  assert.equal(calls.length, 2);
  assert.ok(
    calls.every(
      ([, options]) => options.credentials === "omit" && options.signal,
    ),
  );
});
