// @vitest-environment node
import { beforeEach, afterEach, it, expect, vi } from 'vitest';
import { NextRequest } from 'next/server';
import { z } from 'zod';
const mocks = vi.hoisted(() => ({
  whitelist: vi.fn(),
  user: vi.fn(),
  verify: vi.fn(),
  snapshot: vi.fn(),
}));
vi.mock('server-only', () => ({}));
vi.mock('@/lib/auth/get-secret', () => ({
  getSecret: () => Promise.resolve('offline-auth-handler-test-secret-only'),
}));
vi.mock('@/lib/auth/whitelist', () => ({ isEmailWhitelisted: mocks.whitelist }));
vi.mock('@/lib/auth/users', () => ({
  getUserByEmail: mocks.user,
  getAccountSnapshot: mocks.snapshot,
}));
vi.mock('@/lib/auth/passwords', () => ({ verifyPassword: mocks.verify }));
beforeEach(() => {
  vi.resetModules();
  vi.resetAllMocks();
  vi.stubEnv('NEXT_PUBLIC_APP_MODE', 'production');
  vi.stubEnv('AUTH_SECRET', 'offline-auth-handler-test-secret-only');
  vi.stubEnv('NEXTAUTH_SECRET', '');
  vi.stubEnv('AUTH_URL', 'http://localhost:3100');
  vi.stubEnv('NEXTAUTH_URL', 'http://localhost:3100');
  mocks.snapshot.mockImplementation(async () => {
    const user: unknown = await mocks.user();
    return {
      user,
      access: { email: 'real@example.test', role: 'admin', isActive: true, userId: 'real-user' },
    };
  });
  mocks.whitelist.mockResolvedValue(true);
  mocks.verify.mockResolvedValue(true);
  mocks.user.mockResolvedValue({
    id: 'real-user',
    email: 'real@example.test',
    password: 'private-hash',
    role: 'admin',
    mustChangePassword: true,
    createdAt: '',
    updatedAt: '',
    authVersion: 0,
  });
});
afterEach(() => vi.unstubAllEnvs());
async function login(password = 'correct', csrf = true, email = 'real@example.test') {
  const { handlers } = await import('@/lib/auth/auth');
  const cookies = new Map<string, string>();
  function accept(response: Response) {
    for (const cookie of response.headers.getSetCookie()) {
      const first = cookie.split(';')[0];
      const split = first.indexOf('=');
      cookies.set(first.slice(0, split), first.slice(split + 1));
    }
  }
  const header = () => [...cookies].map(([key, value]) => key + '=' + value).join('; ');
  const tokenResponse = await handlers.GET(new NextRequest('http://localhost:3100/api/auth/csrf'));
  expect(tokenResponse.status).toBe(200);
  accept(tokenResponse);
  const token = z.object({ csrfToken: z.string().min(1) }).parse(await tokenResponse.json());
  const response = await handlers.POST(
    new NextRequest('http://localhost:3100/api/auth/callback/credentials', {
      method: 'POST',
      headers: { cookie: header(), 'content-type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        email,
        password,
        csrfToken: csrf ? token.csrfToken : 'invalid',
        callbackUrl: 'http://localhost:3100/repos',
      }),
    }),
  );
  accept(response);
  const session = await handlers.GET(
    new NextRequest('http://localhost:3100/api/auth/session', { headers: { cookie: header() } }),
  );
  const body: unknown = await session.json();
  const refresh = async () => {
    const response = await handlers.GET(
      new NextRequest('http://localhost:3100/api/auth/session', { headers: { cookie: header() } }),
    );
    const value: unknown = await response.json();
    return value;
  };
  const update = async (data: unknown) => {
    const response = await handlers.POST(
      new NextRequest('http://localhost:3100/api/auth/session', {
        method: 'POST',
        headers: { cookie: header(), 'content-type': 'application/json' },
        body: JSON.stringify({ csrfToken: token.csrfToken, data }),
      }),
    );
    const value: unknown = await response.json();
    return value;
  };
  return { response, body, refresh, update };
}
it('uses production credentials, issues a session cookie, and exposes safe session fields', async () => {
  const { response, body } = await login();
  expect(response.headers.get('location')).toBe('http://localhost:3100/repos');
  expect(mocks.verify).toHaveBeenCalledWith('correct', 'private-hash');
  expect(body).toMatchObject({
    user: { id: 'real-user', email: 'real@example.test', role: 'admin', mustChangePassword: true },
  });
  expect(JSON.stringify(body)).not.toContain('private-hash');
});
it('does not issue a session for incorrect passwords or preview credentials in production', async () => {
  mocks.verify.mockResolvedValue(false);
  const { response, body } = await login('preview');
  expect(response.headers.get('location')).toContain('CredentialsSignin');
  expect(body).toBeNull();
  expect(mocks.verify).toHaveBeenCalledWith('preview', 'private-hash');
});
it('rejects invalid CSRF before authorizing credentials', async () => {
  const { body } = await login('correct', false);
  expect(body).toBeNull();
  expect(mocks.whitelist).not.toHaveBeenCalled();
});
it('fails closed when the account store is unavailable', async () => {
  mocks.user.mockRejectedValue(new Error('controlled store outage'));
  const { response, body } = await login();
  expect(response.headers.get('location')).toContain('/auth/error');
  expect(body).toBeNull();
});
it('uses only the explicit preview accounts in preview and never reads real storage', async () => {
  vi.stubEnv('NEXT_PUBLIC_APP_MODE', 'preview');
  const accepted = await login('preview', true, 'alice@example.test');
  expect(accepted.body).toMatchObject({ user: { email: 'alice@example.test' } });
  const rejected = await login('wrong', true, 'alice@example.test');
  expect(rejected.body).toBeNull();
  const unknown = await login('preview', true, 'unknown@example.test');
  expect(unknown.body).toBeNull();
  expect(mocks.whitelist).not.toHaveBeenCalled();
  expect(mocks.user).not.toHaveBeenCalled();
});
it('invalidates a real signed session after its account version changes or access is removed', async () => {
  const session = await login();
  expect(session.body).toMatchObject({ user: { role: 'admin' } });
  mocks.snapshot.mockResolvedValue({
    user: {
      id: 'real-user',
      email: 'real@example.test',
      password: 'new-hash',
      role: 'admin',
      authVersion: 1,
      createdAt: '',
      updatedAt: '',
    },
    access: { email: 'real@example.test', isActive: true, role: 'admin' },
  });
  expect(await session.refresh()).toBeNull();
  const another = await login(); // Its old credentials/version are rejected too.
  expect(another.body).toBeNull();
});
it('rechecks permissions and mandatory password changes on the session endpoint', async () => {
  const session = await login();
  mocks.snapshot.mockResolvedValue({
    user: {
      id: 'real-user',
      email: 'real@example.test',
      password: 'private-hash',
      role: 'viewer',
      authVersion: 0,
      mustChangePassword: true,
      createdAt: '',
      updatedAt: '',
    },
    access: { email: 'real@example.test', isActive: true, role: 'admin' },
  });
  expect(await session.refresh()).toMatchObject({
    user: { role: 'viewer', mustChangePassword: true },
  });
  mocks.snapshot.mockResolvedValue({ user: undefined, access: undefined });
  expect(await session.refresh()).toBeNull();
});
it('fails closed when session revalidation cannot read account storage', async () => {
  const session = await login();
  mocks.snapshot.mockRejectedValue(new Error('controlled account outage'));
  expect(await session.refresh()).toBeNull();
});
it('does not let client session updates elevate privileges or revive a revoked session', async () => {
  mocks.user.mockResolvedValue({
    id: 'real-user',
    email: 'real@example.test',
    password: 'private-hash',
    role: 'viewer',
    authVersion: 0,
    createdAt: '',
    updatedAt: '',
  });
  const session = await login();
  expect(session.body).toMatchObject({ user: { role: 'viewer', authVersion: 0 } });
  expect(await session.update({ user: { role: 'admin', authVersion: 99 } })).toMatchObject({
    user: { role: 'viewer', authVersion: 0 },
  });
  mocks.snapshot.mockResolvedValue({ user: undefined, access: undefined });
  expect(await session.update({ user: { role: 'admin', authVersion: 0 } })).toBeNull();
});
