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
import { validateRuntimeSettings, resolveRuntimeSettings } from '@/models/runtime-settings';
const read = vi.hoisted(() => vi.fn());
vi.mock('server-only', () => ({}));
vi.mock('node:fs', async (original) => ({
  ...(await original<typeof import('node:fs')>()),
  readFileSync: read,
}));
let getRuntimeSettings: (typeof import('@/lib/auth/runtime-settings'))['getRuntimeSettings'];
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
beforeEach(async () => {
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
  vi.resetModules();
  ({ getRuntimeSettings } = await import('@/lib/auth/runtime-settings'));
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
it('captures runtime overrides once per process', () => {
  read.mockReturnValue(JSON.stringify(fields));
  vi.stubEnv('DYNAMODB_USERS_TABLE', 'replacement');
  expect(getRuntimeSettings().usersTable).toBe('replacement');
  vi.stubEnv('DYNAMODB_USERS_TABLE', 'changed-after-start');
  read.mockReturnValue('{');
  expect(getRuntimeSettings().usersTable).toBe('replacement');
  expect(read).toHaveBeenCalledOnce();
});
it('refuses malformed configuration and preserves file-error diagnostics', async () => {
  read.mockReturnValue('{');
  expect(() => getRuntimeSettings()).toThrow('Invalid server runtime configuration');
  read.mockImplementation(() => {
    throw Object.assign(new Error('denied'), { code: 'EACCES' });
  });
  expect(() => getRuntimeSettings()).toThrow('Invalid server runtime configuration');
  try {
    getRuntimeSettings();
  } catch (error) {
    expect(error).toBeInstanceOf(Error);
    if (!(error instanceof Error)) throw error;
    expect(error.cause).toMatchObject({ code: 'EACCES' });
  }
  vi.resetModules();
  const restarted = await import('@/lib/auth/runtime-settings');
  read.mockReturnValue(JSON.stringify(fields));
  expect(restarted.getRuntimeSettings()).toEqual(fields);
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
  expect(
    resolveRuntimeSettings({ AWS_REGION: 'eu-west-1', DYNAMODB_REGION: 'us-west-2' }).region,
  ).toBe('us-west-2');
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

it('validates the lifetime consistently at build and process initialization', async () => {
  expect(() => buildRuntimeSettings({ DASHBOARD_TEMP_PASSWORD_HOURS: '' })).toThrow();
  read.mockReturnValue(JSON.stringify(fields));
  vi.stubEnv('DASHBOARD_TEMP_PASSWORD_HOURS', '48');
  expect(getRuntimeSettings().temporaryPasswordHours).toBe(48);
  vi.stubEnv('DASHBOARD_TEMP_PASSWORD_HOURS', '169');
  expect(getRuntimeSettings().temporaryPasswordHours).toBe(48);
  vi.resetModules();
  const restarted = await import('@/lib/auth/runtime-settings');
  expect(() => restarted.getRuntimeSettings()).toThrow('configuration');
});
