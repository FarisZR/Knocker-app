const marker = '<!-- knocker-pr-apk -->';

/** Refresh the APK link only for an open PR whose current commit was built.
 * Read API metadata only: the workflow has comment permissions, including for
 * forks, so no PR source or artifact contents may be loaded as executable code.
 */
module.exports = async function commentAndroidApk({ github, context, core }) {
  const repo = context.repo;
  const eventRun = context.payload.workflow_run;
  const { data: run } = await github.rest.actions.getWorkflowRun({
    ...repo, run_id: eventRun.id,
  });
  if (run.event !== 'pull_request' || run.status !== 'completed' ||
      run.conclusion !== 'success' || run.run_attempt !== eventRun.run_attempt) {
    core.info('Skipping an unsuccessful or superseded build attempt.');
    return;
  }

  const artifacts = await github.paginate(github.rest.actions.listWorkflowRunArtifacts, {
    ...repo, run_id: run.id, per_page: 100,
  });
  const artifact = artifacts.find((item) =>
    item.name === `knocker-apk-${run.run_number}` && !item.expired);
  if (!artifact) {
    core.info('No downloadable APK artifact found.');
    return;
  }

  // Fork builds can have an empty pull_requests array. Resolve their PRs from
  // GitHub's commit association instead of trusting metadata in an artifact.
  const candidates = run.pull_requests.length ? run.pull_requests :
    await github.paginate(github.rest.repos.listPullRequestsAssociatedWithCommit, {
      ...repo, commit_sha: run.head_sha, per_page: 100,
    });
  const runUrl = `${context.serverUrl}/${repo.owner}/${repo.repo}/actions/runs/${run.id}`;
  const body = [
    marker,
    `<!-- knocker-apk-run:${run.id}:${run.run_attempt} -->`,
    '**Android test build**',
    '',
    `[Download APK (ZIP)](${runUrl}/artifacts/${artifact.id}) · [Build log](${runUrl})`,
    '',
    `Commit: \`${run.head_sha}\`. ARM64, debug-signed release build with embedded JavaScript; no Metro server needed.`,
    '',
    'Sign in to GitHub, download and extract the ZIP, then install the APK on an ARM64 Android device. It cannot update a production-signed installation.',
    '',
    `Available until ${artifact.expires_at.slice(0, 10)} (14-day retention), unless the artifact or run is deleted earlier. This comment refreshes after each successful build of the current PR commit.`,
  ].join('\n');

  for (const candidate of candidates) {
    const { data: pr } = await github.rest.pulls.get({
      ...repo, pull_number: candidate.number,
    });
    if (pr.state !== 'open' || pr.head.sha !== run.head_sha ||
        pr.base.repo.id !== context.payload.repository.id) continue;

    const comments = await github.paginate(github.rest.issues.listComments, {
      ...repo, issue_number: pr.number, per_page: 100,
    });
    const existing = comments.find((item) =>
      item.user.login === 'github-actions[bot]' && item.body.includes(marker));
    if (existing) {
      const previous = existing.body.match(/<!-- knocker-apk-run:(\d+):(\d+) -->/);
      if (previous && (Number(previous[1]) > run.id ||
          (Number(previous[1]) === run.id && Number(previous[2]) >= run.run_attempt))) continue;
      await github.rest.issues.updateComment({ ...repo, comment_id: existing.id, body });
    } else {
      await github.rest.issues.createComment({ ...repo, issue_number: pr.number, body });
    }
  }
};
