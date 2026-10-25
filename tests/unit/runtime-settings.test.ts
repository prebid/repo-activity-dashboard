// @vitest-environment node
import { it, expect, vi, beforeEach, afterEach } from 'vitest';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { buildRuntimeSettings, writeRuntimeSettings } from '../../scripts/runtime-settings.mjs';
import { validateRuntimeSettings } from '@/models/runtime-settings';
const read = vi.hoisted(() => vi.fn());
vi.mock('server-only', () => ({}));
vi.mock('node:fs', async (original) => ({
  ...(await original<typeof import('node:fs')>()),
  readFileSync: read,
}));
import { getRuntimeSettings } from '@/lib/auth/runtime-settings';
const fields = {
  version: 1,
  managed: true,
  region: 'us-east-2',
  usersTable: 'users',
  whitelistTable: 'whitelist',
  authUrl: 'https://dashboard.example.test',
  secretArn: 'arn:aws:secretsmanager:us-east-2:123456789012:secret:dashboard-key',
};
beforeEach(() => {
  read.mockReset();
  for (const key of [
    'AWS_APP_ID',
    'AWS_REGION',
    'DYNAMODB_REGION',
    'S3_REGION',
    'DYNAMODB_USERS_TABLE',
    'DYNAMODB_WHITELIST_TABLE',
    'AUTH_URL',
    'NEXTAUTH_URL',
    'DASHBOARD_AUTH_SECRET_ARN',
  ])
    vi.stubEnv(key, '');
});
afterEach(() => vi.unstubAllEnvs());
it('loads managed server configuration without build-time environment variables', () => {
  read.mockReturnValue(JSON.stringify(fields));
  vi.stubEnv('AWS_REGION', 'us-west-2'); // Hosting region must not replace the configured table region.
  expect(getRuntimeSettings()).toEqual(fields);
});
it('falls back to the configuration packaged inside the server artifact', () => {
  read
    .mockImplementationOnce(() => {
      throw Object.assign(new Error('missing'), { code: 'ENOENT' });
    })
    .mockReturnValue(JSON.stringify(fields));
  expect(getRuntimeSettings()).toEqual(fields);
  expect(read.mock.calls[1][0]).toContain('.next/server/dashboard-runtime.json');
});
it('honors explicit runtime overrides and refuses malformed configuration files', () => {
  read.mockReturnValue(JSON.stringify(fields));
  vi.stubEnv('DYNAMODB_USERS_TABLE', 'replacement');
  expect(getRuntimeSettings().usersTable).toBe('replacement');
  read.mockReturnValue('{');
  expect(() => getRuntimeSettings()).toThrow('Invalid server runtime configuration');
  read.mockImplementation(() => {
    throw new Error('permission denied');
  });
  expect(() => getRuntimeSettings()).toThrow('Invalid server runtime configuration');
});
it('supports unconfigured local builds but refuses incomplete managed deployments', () => {
  read.mockImplementation(() => {
    throw Object.assign(new Error('missing'), { code: 'ENOENT' });
  });
  expect(getRuntimeSettings()).toMatchObject({ managed: false, region: 'us-east-2' });
  expect(() => buildRuntimeSettings({ AWS_APP_ID: 'test-app' })).toThrow(
    'Managed authentication requires',
  );
});
it.each([
  { ...fields, authUrl: 'http://dashboard.example.test' },
  { ...fields, authUrl: 'https://user:pass@dashboard.example.test' },
  { ...fields, authUrl: 'https://dashboard.example.test/path' },
  { ...fields, usersTable: 'whitelist' },
  { ...fields, secretArn: 'not-an-arn' },
  { ...fields, secret: 'should-never-be-here' },
])('rejects unsafe or ambiguous runtime settings %#', (input) =>
  expect(() => validateRuntimeSettings(input)).toThrow(),
);
it('persists only non-secret allowlisted configuration', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'runtime-config-'));
  try {
    const path = join(directory, 'runtime.json');
    await writeRuntimeSettings(
      {
        AWS_APP_ID: 'app',
        AWS_REGION: fields.region,
        DYNAMODB_USERS_TABLE: fields.usersTable,
        DYNAMODB_WHITELIST_TABLE: fields.whitelistTable,
        AUTH_URL: fields.authUrl,
        DASHBOARD_AUTH_SECRET_ARN: fields.secretArn,
        AUTH_SECRET: 'secret-canary-never-persist',
        AWS_SECRET_ACCESS_KEY: 'access-canary-never-persist',
        S3_SECRET_ACCESS_KEY: 'legacy-canary-never-persist',
      },
      path,
    );
    const saved = await readFile(path, 'utf8');
    expect(JSON.parse(saved)).toEqual(fields);
    expect(saved).not.toContain('canary');
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});
