// @vitest-environment node
import { beforeEach, afterEach, it, expect, vi } from 'vitest';
import { makeSecretLoader, validateAuthSecret, previewSecret } from '@/lib/auth/secret-policy';
const mocks = vi.hoisted(() => ({ send: vi.fn(), construct: vi.fn() }));
vi.mock('server-only', () => ({}));
vi.mock('@/lib/auth/runtime-settings', () => import('../fakes/runtime-settings'));
vi.mock('@aws-sdk/client-secrets-manager', () => ({
  SecretsManagerClient: class {
    constructor(config: unknown) {
      mocks.construct(config);
    }
    send = mocks.send;
  },
  GetSecretValueCommand: class {
    constructor(public input: unknown) {}
  },
}));
const key = 'secret-fixture-that-is-long-enough-and-not-live';
const arn = 'arn:aws:secretsmanager:us-east-2:123456789012:secret:dashboard';
beforeEach(() => {
  vi.resetModules();
  vi.resetAllMocks();
  vi.stubEnv('NEXT_PUBLIC_APP_MODE', 'production');
  vi.stubEnv('DASHBOARD_AUTH_SECRET_ARN', arn);
  vi.stubEnv('AUTH_URL', 'https://dashboard.example.test');
});
afterEach(() => {
  vi.unstubAllEnvs();
  vi.useRealTimers();
});
it('retrieves the managed key with IAM defaults and reuses its client after cache expiry', async () => {
  vi.useFakeTimers();
  mocks.send.mockResolvedValue({ SecretString: JSON.stringify({ authSecret: key }) });
  const { getSecret } = await import('@/lib/auth/get-secret');
  expect(await getSecret()).toBe(key);
  expect(await getSecret()).toBe(key);
  expect(mocks.send).toHaveBeenCalledTimes(1);
  expect(mocks.construct).toHaveBeenCalledExactlyOnceWith({
    region: 'us-east-2',
    maxAttempts: 2,
    requestHandler: {
      connectionTimeout: 1000,
      requestTimeout: 3000,
      socketTimeout: 3000,
      throwOnRequestTimeout: true,
    },
  });
  expect(mocks.send.mock.calls[0][0]).toMatchObject({ input: { SecretId: arn } });
  expect(mocks.send.mock.calls[0][1]).toHaveProperty('abortSignal', expect.any(AbortSignal));
  vi.advanceTimersByTime(60_001);
  expect(await getSecret()).toBe(key);
  expect(mocks.send).toHaveBeenCalledTimes(2);
  expect(mocks.construct).toHaveBeenCalledTimes(1);
});
it('does not contact Secrets Manager in preview', async () => {
  vi.stubEnv('NEXT_PUBLIC_APP_MODE', 'preview');
  const { getSecret } = await import('@/lib/auth/get-secret');
  expect(await getSecret()).toBe(previewSecret);
  expect(mocks.construct).not.toHaveBeenCalled();
});
it('coalesces concurrent loads, expires the cache, and never falls back to stale keys after failure', async () => {
  let now = 0;
  const read = vi.fn().mockResolvedValue(key);
  const load = makeSecretLoader(read, () => now);
  expect(await Promise.all([load(arn), load(arn)])).toEqual([key, key]);
  expect(read).toHaveBeenCalledTimes(1);
  now = 60_000;
  read.mockRejectedValue(new Error('provider error containing secret payload'));
  await expect(load(arn)).rejects.toThrow('Authentication secret is unavailable');
  read.mockResolvedValue(key);
  expect(await load(arn)).toBe(key);
  expect(read).toHaveBeenCalledTimes(3);
  expect(await load(arn + '-new')).toBe(key);
  expect(read).toHaveBeenCalledTimes(4);
});
it.each([
  undefined,
  'short',
  previewSecret,
  ' ' + key,
  '{invalid',
  JSON.stringify({ authSecret: 'short' }),
])('rejects missing, malformed or inappropriate managed secrets %#', async (value) => {
  const load = makeSecretLoader(() => Promise.resolve(value));
  await expect(load(arn)).rejects.toMatchObject({ kind: 'configuration' });
});
it('validates direct runtime keys without exposing rejected values', () => {
  expect(validateAuthSecret(key)).toBe(key);
  expect(() => validateAuthSecret('too-short-canary')).toThrow('at least 32');
});

it('distinguishes a JSON envelope from valid raw text without using a prefix guess', async () => {
  for (const value of ['{' + key, JSON.stringify({ other: key }), key]) {
    expect(await makeSecretLoader(() => Promise.resolve(value))(arn)).toBe(value);
  }
  await expect(
    makeSecretLoader(() => Promise.resolve(JSON.stringify({ authSecret: null })))(arn),
  ).rejects.toMatchObject({ kind: 'configuration' });
  expect(
    await makeSecretLoader(() => Promise.resolve(JSON.stringify({ authSecret: '{' + key })))(arn),
  ).toBe('{' + key);
});

it('retains a provider cause for safe diagnostic classification', async () => {
  const cause = Object.assign(new Error('private provider detail'), {
    name: 'AccessDeniedException',
  });
  await expect(makeSecretLoader(() => Promise.reject(cause))(arn)).rejects.toMatchObject({
    kind: 'unavailable',
    cause,
  });
});

it('releases coalesced callers at the deadline and ignores a late provider result', async () => {
  vi.useFakeTimers();
  let finishLate!: (value: string) => void;
  let signal: AbortSignal | undefined;
  const read = vi
    .fn<(arn: string, signal: AbortSignal) => Promise<unknown>>()
    .mockImplementationOnce((_arn, suppliedSignal) => {
      signal = suppliedSignal;
      return new Promise<string>((resolve) => {
        finishLate = resolve;
      });
    })
    .mockResolvedValue(key);
  const load = makeSecretLoader(read);
  const failed = expect(Promise.all([load(arn), load(arn)])).rejects.toMatchObject({
    kind: 'unavailable',
    cause: { name: 'TimeoutError' },
  });
  await vi.advanceTimersByTimeAsync(5000);
  await failed;
  expect(read).toHaveBeenCalledTimes(1);
  expect(signal?.aborted).toBe(true);
  expect(await load(arn)).toBe(key);
  finishLate('late-provider-value-that-must-not-replace-the-current-key');
  await Promise.resolve();
  expect(await load(arn)).toBe(key);
  expect(read).toHaveBeenCalledTimes(2);
  expect(vi.getTimerCount()).toBe(0);
});

it('uses the existing signing key without Secrets Manager when compatibility is explicit', async () => {
  vi.stubEnv('DASHBOARD_AUTH_BACKEND', 'legacy');
  vi.doMock('@/lib/auth/legacy-runtime', () => ({
    getLegacyAuthSettings: () => ({ secret: key }),
  }));
  try {
    const { getSecret } = await import('@/lib/auth/get-secret');
    expect(await getSecret()).toBe(key);
    expect(mocks.construct).not.toHaveBeenCalled();
  } finally {
    vi.doUnmock('@/lib/auth/legacy-runtime');
  }
});
