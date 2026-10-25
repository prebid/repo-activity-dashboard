import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest';
const mocks = vi.hoisted(() => ({ construct: vi.fn(), from: vi.fn(() => ({ send: vi.fn() })) }));
vi.mock('server-only', () => ({}));
vi.mock('@aws-sdk/client-dynamodb', () => ({
  DynamoDBClient: class {
    constructor(config: unknown) {
      mocks.construct(config);
    }
  },
}));
vi.mock('@aws-sdk/lib-dynamodb', () => ({ DynamoDBDocumentClient: { from: mocks.from } }));
beforeEach(() => {
  vi.stubEnv('S3_ACCESS_KEY_ID', '');
  vi.stubEnv('S3_SECRET_ACCESS_KEY', '');
  vi.stubEnv('S3_SESSION_TOKEN', '');
  vi.stubEnv('AWS_ACCESS_KEY_ID', 'test-access-key');
  vi.stubEnv('AWS_SECRET_ACCESS_KEY', 'test-secret-key');
  vi.stubEnv('AWS_SESSION_TOKEN', 'test-session-token');
});
afterEach(() => {
  vi.unstubAllEnvs();
  vi.resetModules();
  vi.clearAllMocks();
});
describe('retained account-store boundary', () => {
  it('refuses account storage in preview before constructing a client', async () => {
    vi.stubEnv('NEXT_PUBLIC_APP_MODE', 'preview');
    vi.resetModules();
    const { getDocClient } = await import('@/lib/aws/clients');
    expect(() => getDocClient()).toThrow('unavailable in preview');
    expect(mocks.construct).not.toHaveBeenCalled();
    expect(mocks.from).not.toHaveBeenCalled();
  });
  it('creates the retained production client lazily and reuses it', async () => {
    vi.stubEnv('NEXT_PUBLIC_APP_MODE', 'production');
    vi.resetModules();
    const { getDocClient } = await import('@/lib/aws/clients');
    expect(mocks.construct).not.toHaveBeenCalled();
    const client = getDocClient();
    expect(getDocClient()).toBe(client);
    expect(mocks.construct).toHaveBeenCalledOnce();
    expect(mocks.construct.mock.calls[0][0]).not.toHaveProperty('credentials');
    expect(mocks.from).toHaveBeenCalledOnce();
  });
});
