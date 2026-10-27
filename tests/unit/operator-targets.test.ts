// @vitest-environment node
import { beforeEach, afterEach, it, expect, vi } from 'vitest';
const mocks = vi.hoisted(() => ({
  construct: vi.fn<(config: unknown) => void>(),
  send: vi.fn(),
  destroy: vi.fn(),
}));
vi.mock('server-only', () => ({}));
vi.mock('@aws-sdk/client-dynamodb', async (original) => ({
  ...(await original<typeof import('@aws-sdk/client-dynamodb')>()),
  DynamoDBClient: class {
    constructor(config: unknown) {
      mocks.construct(config);
    }
  },
}));
vi.mock('@aws-sdk/lib-dynamodb', async (original) => ({
  ...(await original<typeof import('@aws-sdk/lib-dynamodb')>()),
  DynamoDBDocumentClient: { from: () => ({ send: mocks.send, destroy: mocks.destroy }) },
}));
beforeEach(() => {
  vi.resetModules();
  vi.clearAllMocks();
  mocks.send.mockResolvedValue({ Items: [] });
  for (const key of [
    'AWS_APP_ID',
    'AUTH_URL',
    'NEXTAUTH_URL',
    'DASHBOARD_AUTH_SECRET_ARN',
    'NEXT_PUBLIC_APP_MODE',
    'S3_ACCESS_KEY_ID',
    'S3_SECRET_ACCESS_KEY',
    'DYNAMODB_REGION',
    'DYNAMODB_USERS_TABLE',
    'DYNAMODB_WHITELIST_TABLE',
  ])
    vi.stubEnv(key, '');
});
afterEach(() => vi.unstubAllEnvs());
const command = (region: string, prefix: string) => [
  'migrate',
  '--region',
  region,
  '--users-table',
  prefix + '-users',
  '--whitelist-table',
  prefix + '-whitelist',
];
it('honors each explicit target independently and leaves application configuration unchanged', async () => {
  const { runOperator } = await import('../../scripts/auth-operator');
  expect(await runOperator(command('us-east-2', 'first'))).toEqual({
    accounts: 0,
    linked: 0,
    requiresCredentialReissue: [],
  });
  expect(await runOperator(command('us-west-2', 'second'))).toEqual({
    accounts: 0,
    linked: 0,
    requiresCredentialReissue: [],
  });
  expect(mocks.construct.mock.calls.map(([config]: [unknown]) => config)).toEqual([
    expect.objectContaining({ region: 'us-east-2' }),
    expect.objectContaining({ region: 'us-west-2' }),
  ]);
  expect(process.env.DYNAMODB_USERS_TABLE).toBe('');
  expect(process.env.DYNAMODB_REGION).toBe('');
  expect(mocks.destroy).toHaveBeenCalledTimes(2);
});
it('does not require unrelated web-auth settings for an explicit operator account target', async () => {
  vi.stubEnv('AUTH_URL', 'not-a-web-origin');
  vi.stubEnv('DASHBOARD_AUTH_SECRET_ARN', 'not-a-web-secret');
  const { runOperator } = await import('../../scripts/auth-operator');
  expect(await runOperator(command('us-east-2', 'recovery'))).toEqual({
    accounts: 0,
    linked: 0,
    requiresCredentialReissue: [],
  });
  expect(mocks.send).toHaveBeenCalledTimes(2);
});
it('closes its owned client after an operation fails', async () => {
  mocks.send.mockRejectedValue(new Error('controlled backend failure'));
  const { runOperator } = await import('../../scripts/auth-operator');
  await expect(runOperator(command('us-east-2', 'failed'))).rejects.toThrow(
    'controlled backend failure',
  );
  expect(mocks.destroy).toHaveBeenCalledOnce();
  expect(process.env.DYNAMODB_USERS_TABLE).toBe('');
});
