import { test } from "node:test";
import assert from "node:assert/strict";
import { loadTypeScript } from "./load-typescript.mjs";
const { checkServerStatus } = loadTypeScript(
  new URL("../lib/serverStatus.ts", import.meta.url),
  { "expo/fetch": { fetch: globalThis.fetch } },
);
const profile = {
  endpointUrl: "https://knocker.example/prefix/",
  apiKey: "demo-key",
};
const inactive = {
  ip_address: "198.51.100.7",
  whitelisted: false,
  expires_at: null,
  expires_in_seconds: 0,
};

test("checks only the configured server with its key, preserving a URL prefix", async () => {
  const status = await checkServerStatus(
    profile,
    new AbortController().signal,
    async (url, options) => {
      assert.equal(url, "https://knocker.example/prefix/status");
      assert.equal(options.headers["X-Api-Key"], "demo-key");
      assert.equal(options.credentials, "omit");
      assert.equal(options.cache, "no-store");
      assert.equal(options.redirect, "error");
      return { ok: true, json: async () => inactive };
    },
  );
  assert.equal(typeof status.checkedAt, "number");
  assert.deepEqual(
    { ...status, checkedAt: undefined },
    {
      ipAddress: "198.51.100.7",
      whitelisted: false,
      expiresAt: null,
      checkedAt: undefined,
    },
  );
});

test("uses server coverage, including a different address, with a clock-independent TTL", async () => {
  const before = Date.now();
  const status = await checkServerStatus(
    profile,
    new AbortController().signal,
    async () => ({
      ok: true,
      json: async () => ({
        ip_address: "2001:0db8::1",
        whitelisted: true,
        expires_at: 12345,
        expires_in_seconds: 300,
      }),
    }),
  );
  assert.equal(status.whitelisted, true);
  assert.equal(status.ipAddress, "2001:db8::1");
  assert.ok(
    status.expiresAt >= before + 300000 &&
      status.expiresAt <= Date.now() + 300000,
  );
});

test("errors, unsupported servers, malformed responses and cancellation are unknown", async () => {
  for (const data of [
    {},
    { ...inactive, ip_address: "invalid" },
    { ...inactive, whitelisted: "false" },
    { ...inactive, expires_at: 123 },
    { ...inactive, expires_in_seconds: -1 },
    { ...inactive, whitelisted: true },
    { ...inactive, expires_in_seconds: "0" },
  ]) {
    assert.equal(
      await checkServerStatus(
        profile,
        new AbortController().signal,
        async () => ({ ok: true, json: async () => data }),
      ),
      null,
    );
  }
  assert.equal(
    await checkServerStatus(
      profile,
      new AbortController().signal,
      async () => ({ ok: false }),
    ),
    null,
  );
  assert.equal(
    await checkServerStatus(profile, new AbortController().signal, async () => {
      throw Error("offline");
    }),
    null,
  );
  const controller = new AbortController();
  controller.abort();
  assert.equal(
    await checkServerStatus(profile, controller.signal, async () => {
      assert.fail("aborted request");
    }),
    null,
  );
});

test("a redirect destination never receives the API key", async () => {
  const { createServer } = await import("node:http");
  const { once } = await import("node:events");
  let redirectedRequests = 0;
  const server = createServer((req, res) => {
    if (req.url === "/status") res.writeHead(302, { Location: "/trap" }).end();
    else {
      redirectedRequests++;
      res.end(JSON.stringify(inactive));
    }
  });
  server.listen(0, "127.0.0.1");
  await once(server, "listening");
  try {
    const status = await checkServerStatus(
      {
        endpointUrl: `http://127.0.0.1:${server.address().port}`,
        apiKey: "demo-key",
      },
      new AbortController().signal,
    );
    assert.equal(status, null);
    assert.equal(redirectedRequests, 0);
  } finally {
    server.closeAllConnections();
    await new Promise((resolve) => server.close(resolve));
  }
});
