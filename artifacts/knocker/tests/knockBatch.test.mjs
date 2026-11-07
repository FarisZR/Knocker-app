import { loadTypeScript } from "./load-typescript.mjs";
import assert from "node:assert/strict";
import test from "node:test";

const { knockBatch } = loadTypeScript(
  new URL("../lib/knockBatch.ts", import.meta.url),
);

test("starts every knock before waiting for a response", async () => {
  const started = [];
  const resolvers = new Map();

  const batch = knockBatch(["front", "garage", "office"], (profile) => {
    started.push(profile);
    return new Promise((resolve) => resolvers.set(profile, resolve));
  });

  assert.deepEqual(started, ["front", "garage", "office"]);

  resolvers.get("office")?.("office-ok");
  resolvers.get("front")?.("front-ok");
  resolvers.get("garage")?.("garage-ok");

  assert.deepEqual(await batch, [
    { item: "front", result: "front-ok" },
    { item: "garage", result: "garage-ok" },
    { item: "office", result: "office-ok" },
  ]);
});

test("an empty batch performs no dispatch work", async () => {
  let calls = 0;
  const results = await knockBatch([], async () => {
    calls += 1;
    return "unexpected";
  });

  assert.equal(calls, 0);
  assert.deepEqual(results, []);
});
