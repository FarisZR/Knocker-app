import { readFileSync, appendFileSync, mkdirSync, writeFileSync } from 'node:fs';

const env = process.env;
const base = JSON.parse(readFileSync('app.json')).expo;
const version = env.RELEASE_TAG ? env.RELEASE_TAG.replace(/^v/, '') : env.INPUT_VERSION || base.version;
if (!/^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?$/.test(version)) throw new Error('Use a release tag like v1.0.0 or v1.0.0-beta.1');
// This workflow owns the sequence. Re-running the same run rebuilds the same version.
const code = 1000000 + Number(env.GITHUB_RUN_NUMBER);
if (!Number.isSafeInteger(code) || code > 2100000000) throw new Error('Invalid run number');
const publish = env.PUBLISH === 'true';
const notes = (env.CHANGELOG || '').trim();
if (publish && (!notes || [...notes].length > 500)) throw new Error('Publishing requires 1–500 characters of Play release notes');
if (publish && env.GITHUB_REF !== 'refs/heads/main' && !env.RELEASE_TAG) throw new Error('Dispatch publishing from main only');
mkdirSync('play-release-notes', { recursive: true });
writeFileSync('play-release-notes/whatsnew-en-US', notes);
appendFileSync(env.GITHUB_ENV, `KNOCKER_VERSION_NAME=${version}\nKNOCKER_VERSION_CODE=${code}\n`);
appendFileSync(env.GITHUB_OUTPUT, `version=${version}\npublish=${publish}\n`);
console.log(`Building ${version} (${code}); Play publishing: ${publish}`);
