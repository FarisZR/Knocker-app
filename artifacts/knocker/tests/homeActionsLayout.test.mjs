import test from "node:test";
import assert from "node:assert/strict";
import { loadTypeScript } from "./load-typescript.mjs";
const { homeActionsHeight, snackbarBottom } = loadTypeScript(
  new URL("../lib/homeActionsLayout.ts", import.meta.url),
);
test("six pinned actions and error feedback stay within a compact window", () => {
  const height = 400,
    top = 24,
    feedback = 160;
  const actions = homeActionsHeight(true, 6, height);
  assert.ok(actions <= height * 0.55);
  const bottom = snackbarBottom(32 + actions, height, top, feedback);
  assert.ok(height - bottom - feedback >= top);
});
