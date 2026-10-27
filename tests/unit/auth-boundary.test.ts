vi.mock('@/lib/auth/runtime-settings', () => import('../fakes/runtime-settings'));
import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest';
vi.mock('server-only', () => ({}));
beforeEach(() => {
  vi.stubEnv('DASHBOARD_AUTH_SECRET_ARN', '');
  vi.stubEnv('AUTH_URL', '');
  vi.stubEnv('NEXTAUTH_URL', '');
});
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
    expect(await getSecret()).toContain('local-preview-only');
  });
  it('does not silently fall back to preview in production', async () => {
    vi.stubEnv('NEXT_PUBLIC_APP_MODE', 'production');
    vi.stubEnv('NEXTAUTH_SECRET', '');
    vi.stubEnv('AUTH_SECRET', '');
    vi.stubEnv('AMPLIFY_NEXTAUTH_SECRET', '');
    vi.resetModules();
    const { getSecret } = await import('@/lib/auth/get-secret');
    await expect(getSecret()).rejects.toThrow('requires its own secret');
  });
  it('uses the configured production secret', async () => {
    vi.stubEnv('NEXT_PUBLIC_APP_MODE', 'production');
    vi.stubEnv('AUTH_SECRET', 'unit-test-production-secret-at-least-32-characters');
    vi.stubEnv('NEXTAUTH_SECRET', 'legacy-key-must-not-override-canonical');
    vi.resetModules();
    const { getSecret } = await import('@/lib/auth/get-secret');
    expect(await getSecret()).toBe('unit-test-production-secret-at-least-32-characters');
  });
});
