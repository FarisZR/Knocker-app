import test from 'node:test';
import assert from 'node:assert/strict';
import commentAndroidApk from '../../.github/scripts/android-pr-comment.cjs';

/** Exercise the privileged comment handler against GitHub API responses without
 * network access, credentials, checkout of PR code, or artifact downloads.
 */
function fixture() {
  const state = {
    run: { id: 100, run_number: 44, run_attempt: 1, event: 'pull_request', status: 'completed', conclusion: 'success', head_sha: 'abc123', pull_requests: [{ number: 23 }] },
    artifacts: [{ id: 42, name: 'knocker-apk-44', expired: false, expires_at: '2026-11-25T12:00:00Z' }],
    pr: { number: 23, state: 'open', head: { sha: 'abc123' }, base: { repo: { id: 7 } } },
    associated: [{ number: 23 }], comments: [], writes: [], lookups: [],
  };
  const endpoint = (name) => Object.assign(() => {}, { endpointName: name });
  const github = {
    rest: {
      actions: { getWorkflowRun: async () => ({ data: state.run }), listWorkflowRunArtifacts: endpoint('artifacts') },
      repos: { listPullRequestsAssociatedWithCommit: endpoint('associated') },
      pulls: { get: async () => ({ data: state.pr }) },
      issues: {
        listComments: endpoint('comments'),
        createComment: async (args) => state.writes.push({ action: 'create', ...args }),
        updateComment: async (args) => state.writes.push({ action: 'update', ...args }),
      },
    },
    paginate: async (endpoint, args) => {
      state.lookups.push({ endpoint: endpoint.endpointName, ...args });
      return state[endpoint.endpointName];
    },
  };
  const context = { repo: { owner: 'example', repo: 'app' }, serverUrl: 'https://github.com', payload: { workflow_run: { id: 100, run_attempt: 1 }, repository: { id: 7 } } };
  return { state, context, run: () => commentAndroidApk({ github, context, core: { info() {} } }) };
}

test('links the exact APK and build, with signing, architecture and download details', async () => {
  const f = fixture();
  await f.run();
  assert.equal(f.state.writes.length, 1);
  const comment = f.state.writes[0];
  assert.equal(comment.action, 'create');
  assert.equal(comment.issue_number, 23);
  assert.match(comment.body, /https:\/\/github.com\/example\/app\/actions\/runs\/100\/artifacts\/42/);
  for (const text of ['abc123', 'ARM64', 'debug-signed', 'Sign in to GitHub', '2026-11-25', 'cannot update a production-signed installation']) assert.ok(comment.body.includes(text));
});

test('updates the existing bot comment while leaving user comments untouched', async () => {
  const f = fixture();
  f.state.comments = [
    { id: 1, user: { login: 'contributor' }, body: '<!-- knocker-pr-apk -->' },
    { id: 2, user: { login: 'github-actions[bot]' }, body: '<!-- knocker-pr-apk -->\n<!-- knocker-apk-run:99:1 -->' },
  ];
  await f.run();
  assert.equal(f.state.writes[0].action, 'update');
  assert.equal(f.state.writes[0].comment_id, 2);
});

test('resolves fork PRs with an empty association array using the commit API', async () => {
  const f = fixture();
  f.state.run.pull_requests = [];
  await f.run();
  assert.equal(f.state.writes[0].issue_number, 23);
  assert.ok(f.state.lookups.some((item) => item.endpoint === 'associated' && item.commit_sha === 'abc123'));
});

test('never comments for failed, cancelled, incomplete, non-PR or superseded attempts', async () => {
  for (const overrides of [{ conclusion: 'failure' }, { conclusion: 'cancelled' }, { status: 'in_progress' }, { event: 'push' }, { run_attempt: 2 }]) {
    const f = fixture();
    Object.assign(f.state.run, overrides);
    await f.run();
    assert.equal(f.state.writes.length, 0);
    assert.equal(f.state.lookups.length, 0);
  }
});

test('ignores missing, expired and unrelated artifacts', async () => {
  for (const artifacts of [[], [{ name: 'knocker-apk-44', expired: true }], [{ name: 'knocker-apk-43', expired: false }]]) {
    const f = fixture();
    f.state.artifacts = artifacts;
    await f.run();
    assert.equal(f.state.writes.length, 0);
  }
});

test('ignores closed PRs, stale commits and PRs targeting another repository', async () => {
  for (const overrides of [{ state: 'closed' }, { head: { sha: 'new-commit' } }, { base: { repo: { id: 99 } } }]) {
    const f = fixture();
    Object.assign(f.state.pr, overrides);
    await f.run();
    assert.equal(f.state.writes.length, 0);
  }
});

test('older runs and rerun attempts cannot replace newer links; repeat events are idempotent', async () => {
  for (const version of ['101:1', '100:2', '100:1']) {
    const f = fixture();
    f.state.comments = [{ id: 2, user: { login: 'github-actions[bot]' }, body: `<!-- knocker-pr-apk -->\n<!-- knocker-apk-run:${version} -->` }];
    await f.run();
    assert.equal(f.state.writes.length, 0);
  }
});

test('a successful newer rerun refreshes the same comment', async () => {
  const f = fixture();
  f.state.run.run_attempt = f.context.payload.workflow_run.run_attempt = 2;
  f.state.comments = [{ id: 2, user: { login: 'github-actions[bot]' }, body: '<!-- knocker-pr-apk -->\n<!-- knocker-apk-run:100:1 -->' }];
  await f.run();
  assert.equal(f.state.writes[0].action, 'update');
  assert.match(f.state.writes[0].body, /knocker-apk-run:100:2/);
});
