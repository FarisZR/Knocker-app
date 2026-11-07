import test from "node:test";
import assert from "node:assert/strict";
import { loadTypeScript } from "./load-typescript.mjs";
const load = (native) =>
  loadTypeScript(
    new URL("../modules/knocker-native/index.ts", import.meta.url),
    {
      "react-native": { Platform: { OS: "android" } },
      expo: { requireOptionalNativeModule: () => native },
    },
  );

test("importing or reading results does not start native HTTP; repeated starts/readers share one batch", async () => {
  let started = 0,
    reads = 0,
    finish;
  const bridge = load({
    startLaunchKnocks: async () => {
      started++;
    },
    getLaunchKnockResultsJson: () => {
      reads++;
      return new Promise((resolve) => {
        finish = resolve;
      });
    },
  });
  const first = bridge.awaitLaunchKnockResults();
  assert.equal(started, 0);
  bridge.startLaunchKnocks();
  bridge.startLaunchKnocks();
  await new Promise(setImmediate);
  assert.equal(started, 1);
  assert.equal(reads, 1);
  finish(JSON.stringify([{ profileId: "home", ok: true }]));
  assert.deepEqual(await first, [{ profileId: "home", ok: true }]);
  assert.equal(await first, await bridge.awaitLaunchKnockResults());
  assert.equal(reads, 1);
});
test("unavailable native code and older module versions return an empty fallback batch", async () => {
  for (const native of [null, {}]) {
    const bridge = load(native);
    assert.deepEqual(await bridge.awaitLaunchKnockResults(), []);
    bridge.startLaunchKnocks();
  }
});
test("native errors and malformed results resolve fallback rather than hanging startup", async () => {
  for (const getResults of [
    async () => {
      throw new Error("native error");
    },
    async () => "bad-json",
  ]) {
    const bridge = load({
      startLaunchKnocks: async () => {},
      getLaunchKnockResultsJson: getResults,
    });
    bridge.startLaunchKnocks();
    assert.deepEqual(await bridge.awaitLaunchKnockResults(), []);
  }
});

test(
  "a slow native connection lookup is bounded",
  { timeout: 1000 },
  async () => {
    const bridge = load({ getNetworkIdentity: () => new Promise(() => {}) });
    assert.equal(await bridge.getNetworkIdentity(), null);
  },
);
test("pending events are shared and a stale initial snapshot cannot overwrite them", async () => {
  let listener,
    initial,
    removed = false;
  const states = [];
  const bridge = load({
    addListener: (_event, callback) => {
      listener = callback;
      return {
        remove: () => {
          removed = true;
        },
      };
    },
    getPendingKnockIdsJson: () =>
      new Promise((resolve) => {
        initial = resolve;
      }),
  });
  const unsubscribe = bridge.subscribeToNativeKnocks((ids) => states.push(ids));
  listener({ profileIds: ["native-profile"] });
  initial("[]");
  await new Promise(setImmediate);
  assert.deepEqual(states, [["native-profile"]]);
  listener({ profileIds: [] });
  unsubscribe();
  listener({ profileIds: ["late"] });
  assert.deepEqual(states, [["native-profile"], []]);
  assert.equal(removed, true);
});
