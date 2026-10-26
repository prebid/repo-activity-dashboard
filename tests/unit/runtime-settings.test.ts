// @vitest-environment node
import { it, expect, vi, beforeEach, afterEach } from 'vitest';
import { mkdtemp, readFile, rm, stat, chmod } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import {
  buildRuntimeSettings,
  writeRuntimeSettings,
  writeRuntimeFile,
} from '../../scripts/runtime-settings.mjs';
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
  temporaryPasswordHours: 24,
  region: 'us-east-2',
  usersTable: 'users',
  whitelistTable: 'whitelist',
  authUrl: 'https://dashboard.example.test',
  secretArn: 'arn:aws:secretsmanager:us-east-2:123456789012:secret:dashboard-key',
};
beforeEach(() => {
  read.mockReset();
  vi.stubEnv('DASHBOARD_TEMP_PASSWORD_HOURS', undefined);
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
  expect(getRuntimeSettings()).toMatchObject({ managed: false, region: undefined });
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
        DYNAMODB_REGION: fields.region,
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

it('requires an explicit managed table region and never packages a hosting default', () => {
  expect(
    buildRuntimeSettings({ AWS_REGION: 'eu-west-1', S3_REGION: 'us-east-2' }).region,
  ).toBeUndefined();
  expect(() => buildRuntimeSettings({ AWS_APP_ID: 'app', AWS_REGION: 'us-east-2' })).toThrow(
    'explicit account-store region',
  );
  read.mockReturnValue(JSON.stringify({ version: 1, managed: false }));
  vi.stubEnv('AWS_REGION', 'eu-west-1');
  expect(getRuntimeSettings().region).toBe('eu-west-1');
  vi.stubEnv('DYNAMODB_REGION', 'us-west-2');
  expect(getRuntimeSettings().region).toBe('us-west-2');
  read.mockImplementation(() => {
    throw Object.assign(new Error('denied'), { code: 'EACCES' });
  });
  let caught: unknown;
  try {
    getRuntimeSettings();
  } catch (error) {
    caught = error;
  }
  expect(caught).toBeInstanceOf(Error);
  if (!(caught instanceof Error)) throw new Error('Expected configuration failure');
  expect(caught.cause).toMatchObject({ code: 'EACCES' });
});
it('makes non-secret packaged files readable even with restrictive umask or existing modes', async () => {
  const root = await mkdtemp(join(tmpdir(), 'runtime-mode-'));
  const previous = process.umask(0o077);
  try {
    const path = join(root, 'settings.json');
    await writeRuntimeSettings({}, path);
    expect((await stat(path)).mode & 0o777).toBe(0o644);
    await chmod(path, 0o600);
    await writeRuntimeFile(path, await readFile(path));
    expect((await stat(path)).mode & 0o777).toBe(0o644);
  } finally {
    process.umask(previous);
    await rm(root, { recursive: true, force: true });
  }
});

it('validates the lifetime consistently for build and runtime overrides', () => {
  expect(() => buildRuntimeSettings({ DASHBOARD_TEMP_PASSWORD_HOURS: '' })).toThrow();
  read.mockReturnValue(JSON.stringify(fields));
  vi.stubEnv('DASHBOARD_TEMP_PASSWORD_HOURS', '48');
  expect(getRuntimeSettings().temporaryPasswordHours).toBe(48);
  vi.stubEnv('DASHBOARD_TEMP_PASSWORD_HOURS', '169');
  expect(() => getRuntimeSettings()).toThrow('configuration');
});
