import { test } from "node:test";
import assert from "node:assert/strict";
import { loadTypeScript } from "./load-typescript.mjs";
const { RecoveryBudget } = loadTypeScript(
  new URL("../lib/recoveryBudget.ts", import.meta.url),
);

test("unknown coverage retries on a stable network with a finite budget", () => {
  const budget = new RecoveryBudget();
  assert.equal(budget.ready("profile:target:wifi", 0), false);
  assert.equal(budget.claim("profile:target:wifi", 0), true);
  assert.equal(budget.ready("profile:target:wifi", 29999), false);
  assert.equal(budget.ready("profile:target:wifi", 30000), true);
  assert.equal(budget.claim("profile:target:wifi", 30000), true);
  assert.equal(budget.claim("profile:target:wifi", 60000), true);
  assert.equal(budget.ready("profile:target:wifi", 90000), false);
  assert.equal(budget.claim("profile:target:wifi", 90000), false);
});

test("grant refreshes cannot cause immediate repeated automatic knocks", () => {
  const budget = new RecoveryBudget();
  assert.equal(budget.claim("profile:target:wifi", 1000), true);
  for (let now = 1001; now < 30000; now += 1000)
    assert.equal(budget.claim("profile:target:wifi", now), false);
  assert.equal(budget.claim("profile:new-target:wifi", 2000), true);
  assert.equal(budget.claim("profile:target:cellular", 2000), true);
});

test("known status stops failure retries", () => {
  const budget = new RecoveryBudget();
  budget.claim("profile:target:wifi", 0);
  budget.forget("profile:target:wifi");
  assert.equal(budget.ready("profile:target:wifi", 30000), false);
});
