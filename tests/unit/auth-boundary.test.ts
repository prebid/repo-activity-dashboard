import { describe, it, expect, vi, afterEach } from 'vitest';
afterEach(() => {
  vi.unstubAllEnvs();
  vi.resetModules();
});
describe('authentication configuration', () => {
  it('supplies an explicit preview secret without live configuration', async () => {
    vi.stubEnv('NEXT_PUBLIC_APP_MODE', 'preview');
    vi.stubEnv('NEXTAUTH_SECRET', '');
    vi.stubEnv('AUTH_SECRET', '');
    vi.stubEnv('AMPLIFY_NEXTAUTH_SECRET', '');
    vi.resetModules();
    const { getSecret } = await import('@/lib/auth/get-secret');
    expect(getSecret()).toContain('local-preview-only');
  });
  it('does not silently fall back to preview in production', async () => {
    vi.stubEnv('NEXT_PUBLIC_APP_MODE', 'production');
    vi.stubEnv('NEXTAUTH_SECRET', '');
    vi.stubEnv('AUTH_SECRET', '');
    vi.stubEnv('AMPLIFY_NEXTAUTH_SECRET', '');
    vi.resetModules();
    const { getSecret } = await import('@/lib/auth/get-secret');
    expect(() => getSecret()).toThrow('requires its own secret');
  });
  it('uses the configured production secret', async () => {
    vi.stubEnv('NEXT_PUBLIC_APP_MODE', 'production');
    vi.stubEnv('NEXTAUTH_SECRET', 'unit-test-production-secret');
    vi.resetModules();
    const { getSecret } = await import('@/lib/auth/get-secret');
    expect(getSecret()).toBe('unit-test-production-secret');
  });
});
