import { test } from "node:test";
import assert from "node:assert/strict";
import { loadTypeScript } from "./load-typescript.mjs";
const { compareGrantAddress } = loadTypeScript(
  new URL("../lib/addresses.ts", import.meta.url),
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
