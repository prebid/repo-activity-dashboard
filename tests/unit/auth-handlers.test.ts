// @vitest-environment node
import { beforeEach, afterEach, it, expect, vi } from 'vitest';
import { NextRequest } from 'next/server';
import { z } from 'zod';
const mocks = vi.hoisted(() => ({
  whitelist: vi.fn(),
  user: vi.fn(),
  verify: vi.fn(),
  snapshot: vi.fn(),
  secret: vi.fn(),
}));
vi.mock('server-only', () => ({}));
vi.mock('@/lib/auth/runtime-settings', () => import('../fakes/runtime-settings'));
vi.mock('@/lib/auth/get-secret', () => ({
  getSecret: mocks.secret,
}));
vi.mock('@/lib/auth/server-account-store', () => ({
  getServerAccountStore: () => ({
    getAccountSnapshot: mocks.snapshot,
    getCredentialSnapshot: async (email: string) => {
      const user: unknown = await mocks.user(email);
      const active: unknown = await mocks.whitelist(email);
      return { user, access: { email, role: 'admin', isActive: active, userId: 'real-user' } };
    },
  }),
}));
vi.mock('@/lib/auth/passwords', () => ({ verifyPassword: mocks.verify }));
beforeEach(() => {
  vi.resetModules();
  vi.resetAllMocks();
  vi.stubEnv('NEXT_PUBLIC_APP_MODE', 'production');
  mocks.secret.mockResolvedValue('offline-auth-handler-test-secret-only');
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
    temporaryPasswordExpiresAt: '2099-01-01T00:00:00.000Z',
    createdAt: '',
    updatedAt: '',
    authVersion: 0,
  });
});
afterEach(() => vi.unstubAllEnvs());
async function login(password = 'correct', csrf = true, email = 'real@example.test') {
  const { handlers } = await import('@/lib/auth/http-auth');
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
  return { response, body, refresh, update, header };
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
      temporaryPasswordExpiresAt: '2099-01-01T00:00:00.000Z',
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
it('preserves a valid cookie during a store outage and recovers with that same cookie', async () => {
  const session = await login();
  mocks.snapshot.mockRejectedValueOnce(new Error('controlled account outage'));
  const { handlers } = await import('@/lib/auth/http-auth');
  const response = await handlers.GET(
    new NextRequest('http://localhost:3100/api/auth/session', {
      headers: { cookie: session.header() },
    }),
  );
  expect(response.status).toBe(503);
  expect(response.headers.getSetCookie()).toEqual([]);
  expect(await response.json()).toEqual({
    error: 'Authentication is temporarily unavailable. Please try again.',
  });
  expect(await session.refresh()).toMatchObject({ user: { id: 'real-user' } });
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

it('bounds authentication bodies before credentials or session callbacks run', async () => {
  const { handlers } = await import('@/lib/auth/http-auth');
  const response = await handlers.POST(
    new NextRequest('http://localhost:3100/api/auth/callback/credentials', {
      method: 'POST',
      body: 'x'.repeat(17000),
    }),
  );
  expect(response.status).toBe(413);
  expect(response.headers.getSetCookie()).toEqual([]);
  expect(mocks.verify).not.toHaveBeenCalled();
  expect(mocks.snapshot).not.toHaveBeenCalled();
});
it('rejects session update without CSRF and distinguishes corrupted records', async () => {
  const session = await login();
  const { handlers } = await import('@/lib/auth/http-auth');
  mocks.snapshot.mockClear();
  const denied = await handlers.POST(
    new NextRequest('http://localhost:3100/api/auth/session', {
      method: 'POST',
      headers: { cookie: session.header(), 'content-type': 'application/json' },
      body: JSON.stringify({ csrfToken: 'invalid', data: { role: 'admin' } }),
    }),
  );
  expect(denied.status).toBe(400);
  expect(mocks.snapshot).not.toHaveBeenCalled();
  mocks.snapshot.mockResolvedValue({ user: { id: 'bad' }, access: {} });
  const corrupted = await handlers.GET(
    new NextRequest('http://localhost:3100/api/auth/session', {
      headers: { cookie: session.header() },
    }),
  );
  expect(corrupted.status).toBe(500);
  expect(corrupted.headers.getSetCookie()).toEqual([]);
});

it('keeps configuration and key-service failures outside the cookie-mutating handler', async () => {
  const { AuthStateError } = await import('@/lib/auth/auth-errors');
  const { handlers } = await import('@/lib/auth/http-auth');
  for (const [kind, status] of [
    ['configuration', 500],
    ['unavailable', 503],
  ] as const) {
    mocks.secret.mockRejectedValue(new AuthStateError(kind));
    const response = await handlers.GET(new NextRequest('http://localhost:3100/api/auth/session'));
    expect(response.status).toBe(status);
    expect(response.headers.getSetCookie()).toEqual([]);
  }
});

it('keeps profiles out of cookies while returning the current profile from storage', async () => {
  const name = 'Long name '.repeat(1200);
  mocks.user.mockResolvedValue({
    id: 'real-user',
    email: 'real@example.test',
    password: 'hash',
    role: 'admin',
    authVersion: 0,
    createdAt: '',
    updatedAt: '',
    mustChangePassword: false,
    name,
  });
  const session = await login();
  expect(session.body).toMatchObject({ user: { name, role: 'admin' } });
  const cookies = session.response.headers
    .getSetCookie()
    .filter((c) => c.includes('session-token='));
  expect(cookies).toHaveLength(1);
  expect(cookies[0].length).toBeLessThan(1200);
});
it('delegates cleanup of a signed pre-upgrade cookie to Auth.js before account lookup', async () => {
  const { encode } = await import('next-auth/jwt');
  const cookie = await encode({
    secret: 'offline-auth-handler-test-secret-only',
    salt: 'authjs.session-token',
    token: { id: 'real-user', email: 'real@example.test', role: 'admin' },
  });
  const { handlers } = await import('@/lib/auth/http-auth');
  const response = await handlers.GET(
    new NextRequest('http://localhost:3100/api/auth/session', {
      headers: { cookie: 'authjs.session-token=' + cookie },
    }),
  );
  expect(await response.json()).toBeNull();
  expect(
    response.headers
      .getSetCookie()
      .some((c) => c.includes('session-token=') && c.includes('Max-Age=0')),
  ).toBe(true);
  expect(mocks.snapshot).not.toHaveBeenCalled();
});

it('does not mint a production session when a provider omits the account revision', async () => {
  mocks.user.mockResolvedValue({
    id: 'real-user',
    email: 'real@example.test',
    password: 'hash',
    role: 'admin',
    createdAt: '',
    updatedAt: '',
    mustChangePassword: false,
  });
  const result = await login();
  expect(result.body).toBeNull();
  expect(mocks.snapshot).not.toHaveBeenCalled();
});

it('uses the normal error page when authentication configuration cannot load', async () => {
  const { AuthStateError } = await import('@/lib/auth/auth-errors');
  mocks.secret.mockRejectedValue(new AuthStateError('configuration'));
  const { handlers } = await import('@/lib/auth/http-auth');
  const response = await handlers.GET(new NextRequest('http://localhost:3100/api/auth/error'));
  expect(response.status).toBe(303);
  expect(response.headers.get('location')).toBe('/auth/error?error=Configuration');
  expect(response.headers.getSetCookie()).toEqual([]);
  const api = await handlers.GET(new NextRequest('http://localhost:3100/api/auth/providers'));
  expect(api.status).toBe(500);
  expect(await api.json()).toEqual({ error: 'Authentication requires operator attention.' });
});

it('returns a reissue code only when the expired temporary password verifies', async () => {
  const user: unknown = await mocks.user();
  if (!user || typeof user !== 'object') throw new Error('Expected account fixture');
  mocks.user.mockResolvedValue({ ...user, temporaryPasswordExpiresAt: '2020-01-01T00:00:00.000Z' });
  const expired = await login();
  expect(expired.response.headers.get('location')).toContain('code=temporary_expired');
  expect(expired.body).toBeNull();
  mocks.verify.mockResolvedValue(false);
  const wrong = await login('wrong');
  expect(wrong.response.headers.get('location')).not.toContain('temporary_expired');
});

it('retains a signed existing cookie in compatibility mode without trusting its stale role', async () => {
  vi.stubEnv('DASHBOARD_AUTH_BACKEND', 'legacy');
  const { encode } = await import('next-auth/jwt');
  const cookie = await encode({
    secret: 'offline-auth-handler-test-secret-only',
    salt: 'authjs.session-token',
    token: { id: 'real-user', email: 'real@example.test', role: 'admin' },
  });
  mocks.snapshot.mockResolvedValue({
    user: {
      id: 'real-user',
      email: 'real@example.test',
      password: 'private-hash',
      role: 'viewer',
      createdAt: '',
      updatedAt: '',
    },
    access: { email: 'real@example.test', role: 'viewer', isActive: true },
    legacy: true,
  });
  const { handlers } = await import('@/lib/auth/http-auth');
  const response = await handlers.GET(
    new NextRequest('http://localhost:3100/api/auth/session', {
      headers: { cookie: 'authjs.session-token=' + cookie },
    }),
  );
  expect(await response.json()).toMatchObject({
    user: { id: 'real-user', role: 'viewer', authVersion: 0 },
  });
});
