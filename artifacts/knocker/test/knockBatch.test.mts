import assert from "node:assert/strict";
import test from "node:test";

import { knockBatch } from "../lib/knockBatch.ts";

test("starts every knock before waiting for a response", async () => {
  const started: string[] = [];
  const resolvers = new Map<string, (value: string) => void>();

  const batch = knockBatch(["front", "garage", "office"], (profile) => {
    started.push(profile);
    return new Promise<string>((resolve) => resolvers.set(profile, resolve));
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
