import { loadTypeScript } from "./load-typescript.mjs";
import assert from "node:assert/strict";
import test from "node:test";

const { pendingKnockFeedback } = loadTypeScript(
  new URL("../lib/knockFeedback.ts", import.meta.url),
);

test("startup feedback uses the same pending text as a manual knock", () => {
  const manual = pendingKnockFeedback(1);
  const startup = pendingKnockFeedback(
    1,
    "Startup request sent · waiting for Knocker server",
  );

  assert.equal(manual.text, "Knocking 1 profile…");
  assert.equal(startup.text, manual.text);
  assert.equal(
    startup.detail,
    "Startup request sent · waiting for Knocker server",
  );
});

test("pending feedback pluralizes profile counts", () => {
  assert.equal(pendingKnockFeedback(3).text, "Knocking 3 profiles…");
});
