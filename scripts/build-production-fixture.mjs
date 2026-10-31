import { spawnSync } from 'node:child_process';
import { readFile, readdir } from 'node:fs/promises';
import { join } from 'node:path';
const secret = 'legacy-artifact-secret-canary-01234567890123456789';
const key = 'legacy-artifact-access-canary';
const credential = 'legacy-artifact-credential-canary';
const environment = Object.fromEntries(
  Object.entries(process.env).filter(
    ([name]) =>
      !/^(AWS_|S3_|DYNAMODB_|AUTH_|NEXTAUTH_|AMPLIFY_|NEXT_PUBLIC_|DASHBOARD_)/.test(name),
  ),
);
const result = spawnSync(process.execPath, ['scripts/app.mjs', 'build', 'production'], {
  stdio: 'inherit',
  env: {
    ...environment,
    NODE_ENV: 'production',
    AWS_APP_ID: 'synthetic-amplify-fixture',
    DASHBOARD_AUTH_BACKEND: 'legacy',
    NEXTAUTH_URL: 'https://dashboard.example.test',
    NEXTAUTH_SECRET: secret,
    S3_REGION: 'us-east-2',
    S3_ACCESS_KEY_ID: key,
    S3_SECRET_ACCESS_KEY: credential,
    DYNAMODB_USERS_TABLE: 'fixture-users',
    DYNAMODB_WHITELIST_TABLE: 'fixture-whitelist',
  },
});
if (result.error || result.signal || result.status !== 0)
  throw new Error('Compatibility production fixture build failed.');
const config = await readFile('.next/server/dashboard-legacy-auth.json', 'utf8');
for (const canary of [secret, key, credential])
  if (!config.includes(canary))
    throw new Error('Private account configuration is missing from the server artifact.');
const settings = await readFile('.next/server/dashboard-runtime.json', 'utf8');
if (!settings.includes('"authBackend":"legacy"') || !settings.includes('"region":"us-east-2"'))
  throw new Error('Existing deployment settings were not packaged.');
/** @param {string} path */
async function checkPublicFiles(path) {
  for (const entry of await readdir(path, { withFileTypes: true })) {
    const file = join(path, entry.name);
    if (entry.isDirectory()) await checkPublicFiles(file);
    else if (entry.isFile()) {
      const value = await readFile(file, 'utf8');
      if ([secret, key, credential].some((canary) => value.includes(canary)))
        throw new Error('Private account configuration reached a public artifact: ' + file);
    }
  }
}
await checkPublicFiles('.next/static');
await checkPublicFiles('public');
console.log(
  'Verified existing-config Amplify build: private server configuration present; secret canaries absent from public assets.',
);
