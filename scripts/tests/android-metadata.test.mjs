import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { resolve, join } from 'node:path';
import { spawnSync } from 'node:child_process';
const script = resolve('scripts/android-metadata.mjs');
/** Exercise metadata generation in an isolated workspace and remove generated files. */
function run(overrides) {
  const cwd = mkdtempSync(join(tmpdir(), 'knocker-version-'));
  mkdirSync(join(cwd, 'artifacts/knocker'), { recursive: true });
  writeFileSync(join(cwd, 'artifacts/knocker/app.json'), JSON.stringify({ expo: { version: '1.0.0' } }));
  const output = join(cwd, 'output');
  const envFile = join(cwd, 'env');
  const result = spawnSync(process.execPath, [script], {
    cwd, encoding: 'utf8', env: { ...process.env, RELEASE_TAG: '', INPUT_VERSION: '', PUBLISH: 'false', CHANGELOG: '', GITHUB_RUN_NUMBER: '42', GITHUB_REF: 'refs/heads/main', ...overrides, GITHUB_ENV: envFile, GITHUB_OUTPUT: output },
  });
  const data = result.status === 0 ? { env: readFileSync(envFile, 'utf8'), notes: readFileSync(join(cwd, 'play-release-notes/whatsnew-en-US'), 'utf8') } : {};
  rmSync(cwd, { recursive: true, force: true });
  return { ...result, ...data };
}
test('release tags set display version while run sequence controls version code', () => {
  assert.match(run({ RELEASE_TAG: 'v2.3.4-beta.1' }).env, /KNOCKER_VERSION_NAME=2.3.4-beta.1\nKNOCKER_VERSION_CODE=1000042/);
});
test('rejects malformed tags and environment-file injection', () => {
  assert.notEqual(run({ RELEASE_TAG: 'v1.2.3\nINJECT=true' }).status, 0);
  assert.notEqual(run({ RELEASE_TAG: 'latest' }).status, 0);
});
test('requires Play notes within the character limit', () => {
  assert.notEqual(run({ PUBLISH: 'true', CHANGELOG: '' }).status, 0);
  assert.notEqual(run({ PUBLISH: 'true', CHANGELOG: 'a'.repeat(501) }).status, 0);
  assert.equal(run({ PUBLISH: 'true', CHANGELOG: 'a'.repeat(500) }).status, 0);
});
test('treats pasted changelog as literal data', () => {
  const notes = 'Fixes\n$(touch pwned) `echo nope`';
  assert.equal(run({ PUBLISH: 'true', CHANGELOG: notes }).notes, notes);
});
test('publishing dispatch must use main; branch builds remain allowed', () => {
  assert.notEqual(run({ PUBLISH: 'true', CHANGELOG: 'Fix', GITHUB_REF: 'refs/heads/feature' }).status, 0);
  assert.equal(run({ GITHUB_REF: 'refs/heads/feature' }).status, 0);
});
