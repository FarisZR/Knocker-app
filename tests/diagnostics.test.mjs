import test from "node:test";
import assert from "node:assert/strict";
import { loadTypeScript } from "./load-typescript.mjs";

const loadBridge = (native) =>
  loadTypeScript(
    new URL("../modules/knocker-native/index.ts", import.meta.url),
    {
      "react-native": { Platform: { OS: "android" } },
      expo: { requireOptionalNativeModule: () => native },
    },
  );

const loadChoice = (
  calls,
  { closeFails = false, saveFails = false, closeHangs = false } = {},
) =>
  loadTypeScript(new URL("../lib/diagnostics.ts", import.meta.url), {
    "@sentry/react-native": {
      close: async () => {
        calls.push(["close"]);
        if (closeHangs) return new Promise(() => {});
        if (closeFails) throw new Error("close failed");
      },
    },
    "knocker-native": {
      setDiagnosticsEnabled: async (enabled) => {
        calls.push(["save", enabled]);
        if (saveFails) throw new Error("save failed");
      },
    },
  });

test("crash reporting is on by default and follows the stored choice", () => {
  assert.equal(loadBridge(null).isDiagnosticsEnabled(), true);
  assert.equal(loadBridge({}).isDiagnosticsEnabled(), true);
  assert.equal(
    loadBridge({ isDiagnosticsEnabled: () => true }).isDiagnosticsEnabled(),
    true,
  );
  assert.equal(
    loadBridge({ isDiagnosticsEnabled: () => false }).isDiagnosticsEnabled(),
    false,
  );
});

test("an unreadable choice keeps crash reporting off instead of guessing", () => {
  const bridge = loadBridge({
    isDiagnosticsEnabled: () => {
      throw new Error("storage unavailable");
    },
  });
  assert.equal(bridge.isDiagnosticsEnabled(), false);
});

test("the choice is stored through the native module and is a no-op without it", async () => {
  const saved = [];
  await loadBridge({
    setDiagnosticsEnabled: async (value) => saved.push(value),
  }).setDiagnosticsEnabled(false);
  assert.deepEqual(saved, [false]);
  await loadBridge(null).setDiagnosticsEnabled(false);
});

test("turning reporting off stops Sentry before the choice is saved", async () => {
  const calls = [];
  await loadChoice(calls).applyDiagnosticsChoice(false);
  assert.deepEqual(calls, [["close"], ["save", false]]);
});

test("turning reporting on only saves; Sentry starts on the next launch", async () => {
  const calls = [];
  await loadChoice(calls).applyDiagnosticsChoice(true);
  assert.deepEqual(calls, [["save", true]]);
});

test("a failed close still saves the choice, and a failed save is reported", async () => {
  const calls = [];
  await loadChoice(calls, { closeFails: true }).applyDiagnosticsChoice(false);
  assert.deepEqual(calls, [["close"], ["save", false]]);

  const failing = [];
  await assert.rejects(
    loadChoice(failing, { saveFails: true }).applyDiagnosticsChoice(false),
    /save failed/,
  );
  // Sentry was already stopped for this session even though saving failed.
  assert.deepEqual(failing, [["close"], ["save", false]]);
});

test("a flush that never finishes cannot block saving the choice", async () => {
  const calls = [];
  await loadChoice(calls, { closeHangs: true }).applyDiagnosticsChoice(false, 10);
  assert.deepEqual(calls, [["close"], ["save", false]]);
});
