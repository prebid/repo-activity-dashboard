// @vitest-environment node
import { it, expect, beforeEach, afterEach, vi } from 'vitest';
import { mkdtemp, readFile, rm, stat } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { legacyAuthSettings } from '@/models/legacy-auth-settings';
import { buildRuntimeSettings, writeLegacyAuthSettings } from '../../scripts/runtime-settings.mjs';
const read = vi.hoisted(() => vi.fn());
vi.mock('server-only', () => ({}));
vi.mock('node:fs', () => ({ readFileSync: read }));
beforeEach(() => {
  read.mockReset();
  vi.resetModules();
});
afterEach(() => vi.unstubAllEnvs());
it('uses only the existing explicit credentials and never captures hosting-role credentials', () => {
  expect(
    legacyAuthSettings({
      NEXTAUTH_SECRET: 'existing-key',
      AWS_ACCESS_KEY_ID: 'hosting-role',
      AWS_SECRET_ACCESS_KEY: 'hosting-secret',
    }),
  ).toEqual({ secret: 'existing-key' });
  expect(
    legacyAuthSettings({
      AUTH_SECRET: 'existing-key',
      S3_ACCESS_KEY_ID: 'existing-id',
      S3_SECRET_ACCESS_KEY: 'existing-secret',
    }),
  ).toEqual({
    secret: 'existing-key',
    credentials: { accessKeyId: 'existing-id', secretAccessKey: 'existing-secret' },
  });
  expect(() =>
    legacyAuthSettings({ NEXTAUTH_SECRET: 'existing-key', S3_ACCESS_KEY_ID: 'incomplete' }),
  ).toThrow();
});
it('accepts the existing Amplify settings without a new secret ARN or explicit region setting', () => {
  expect(
    buildRuntimeSettings({
      AWS_APP_ID: 'fixture',
      DASHBOARD_AUTH_BACKEND: 'legacy',
      NEXTAUTH_URL: 'https://dashboard.example.test',
      S3_REGION: 'us-east-2',
      AWS_REGION: 'us-west-2',
      DYNAMODB_USERS_TABLE: 'users',
      DYNAMODB_WHITELIST_TABLE: 'whitelist',
    }),
  ).toMatchObject({ managed: true, authBackend: 'legacy', region: 'us-east-2' });
  expect(() =>
    buildRuntimeSettings({ AWS_APP_ID: 'fixture', DASHBOARD_AUTH_BACKEND: 'legacy' }),
  ).toThrow('Existing authentication requires account tables and an HTTPS origin.');
});
it('writes private configuration without exposing rejected secret values', async () => {
  const root = await mkdtemp(join(tmpdir(), 'legacy-settings-'));
  const file = join(root, 'private.json');
  try {
    await writeLegacyAuthSettings({ NEXTAUTH_SECRET: 'fixture-secret' }, file);
    expect(JSON.parse(await readFile(file, 'utf8'))).toEqual({ secret: 'fixture-secret' });
    expect((await stat(file)).mode & 0o777).toBe(0o600);
    await expect(
      writeLegacyAuthSettings({ S3_ACCESS_KEY_ID: 'must-not-leak' }, file),
    ).rejects.toThrow('Existing authentication requires');
  } finally {
    await rm(root, { recursive: true });
  }
});
it('loads and caches packaged private settings without a source checkout', async () => {
  read
    .mockImplementationOnce(() => {
      throw Object.assign(new Error('missing'), { code: 'ENOENT' });
    })
    .mockReturnValue(JSON.stringify({ secret: 'fixture-secret' }));
  const { getLegacyAuthSettings } = await import('@/lib/auth/legacy-runtime');
  expect(getLegacyAuthSettings()).toEqual({ secret: 'fixture-secret' });
  expect(getLegacyAuthSettings()).toEqual({ secret: 'fixture-secret' });
  expect(read).toHaveBeenCalledTimes(2);
  expect(read.mock.calls[0][0]).toContain('.next/server/dashboard-legacy-auth.json');
});
it('uses direct legacy runtime settings only when no packaged file exists', async () => {
  read.mockImplementation(() => {
    throw Object.assign(new Error('missing'), { code: 'ENOENT' });
  });
  vi.stubEnv('NEXTAUTH_SECRET', 'direct-fixture-key');
  const { getLegacyAuthSettings } = await import('@/lib/auth/legacy-runtime');
  expect(getLegacyAuthSettings()).toEqual({ secret: 'direct-fixture-key' });
});
it('fails closed on corrupt or unreadable private files without including their contents', async () => {
  read.mockReturnValue('{private-invalid-input');
  const { getLegacyAuthSettings } = await import('@/lib/auth/legacy-runtime');
  expect(() => getLegacyAuthSettings()).toThrow('Existing account configuration is unavailable');
});
