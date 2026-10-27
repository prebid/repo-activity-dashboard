// @vitest-environment node
import { beforeEach, afterEach, it, expect, vi } from 'vitest';
const mocks = vi.hoisted(() => ({
  auth: vi.fn(),
  failure: vi.fn(),
  find: vi.fn(),
  create: vi.fn(),
  list: vi.fn(),
  reset: vi.fn(),
  getById: vi.fn(),
  update: vi.fn(),
  verify: vi.fn(),
  hash: vi.fn(),
}));
vi.mock('@/lib/auth/runtime-settings', () => ({
  getRuntimeSettings: () => ({ authUrl: 'http://localhost' }),
}));
vi.mock('@/lib/auth/viewer', () => ({
  getViewer: async () => {
    const failure = mocks.failure() as 'unavailable' | 'configuration' | 'integrity' | undefined;
    if (failure) return { kind: failure };
    const session = (await mocks.auth()) as {
      user: {
        id: string;
        email: string;
        role?: string;
        authVersion: number;
        mustChangePassword?: boolean;
      };
    } | null;
    return session ? { kind: 'authenticated', user: session.user } : { kind: 'anonymous' };
  },
}));
vi.mock('@/lib/auth/server-account-store', () => ({
  getServerAccountStore: () => ({
    getUserByEmail: mocks.find,
    adminCreateUser: mocks.create,
    listAccountSummaries: mocks.list,
    adminResetPassword: mocks.reset,
    getUserById: mocks.getById,
    changeOwnPassword: mocks.update,
  }),
}));
vi.mock('@/lib/auth/passwords', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/lib/auth/passwords')>()),
  verifyPassword: mocks.verify,
  hashPassword: mocks.hash,
}));
const admin = {
  id: 'admin',
  email: 'admin@example.test',
  role: 'admin',
  mustChangePassword: false,
  authVersion: 0,
};
const request = (body: unknown) =>
  new Request('http://localhost/api/admin/users', {
    method: 'POST',
    headers: { origin: 'http://localhost', 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });
beforeEach(() => {
  vi.resetAllMocks();
  vi.resetModules();
  vi.stubEnv('NEXT_PUBLIC_APP_MODE', 'production');
  mocks.auth.mockResolvedValue({ user: admin });
  mocks.find.mockResolvedValue(null);
  mocks.create.mockResolvedValue({
    user: { id: 'new', email: 'new@example.test' },
    tempPassword: 'one-time',
    expiresAt: '2099-01-01T00:00:00.000Z',
  });
});
afterEach(() => vi.unstubAllEnvs());
it.each([
  [null, 401],
  [{ user: { ...admin, role: 'viewer' } }, 403],
  [{ user: { ...admin, mustChangePassword: true } }, 403],
])('denies unauthorized admin reads and writes before storage', async (session, status) => {
  mocks.auth.mockResolvedValue(session);
  const { GET, POST } = await import('@/app/api/admin/users/route');
  const { POST: reset } = await import('@/app/api/admin/users/reset-password/route');
  expect((await GET()).status).toBe(status);
  expect((await POST(request({ email: 'new@example.test' }))).status).toBe(status);
  expect((await reset(request({ email: 'new@example.test' }))).status).toBe(status);
  for (const mock of [mocks.list, mocks.find, mocks.create, mocks.reset])
    expect(mock).not.toHaveBeenCalled();
});
it('blocks preview before evaluating real auth or storage', async () => {
  vi.stubEnv('NEXT_PUBLIC_APP_MODE', 'preview');
  const { POST } = await import('@/app/api/admin/users/route');
  expect((await POST(request({ email: 'new@example.test' }))).status).toBe(403);
  expect(mocks.auth).not.toHaveBeenCalled();
  expect(mocks.create).not.toHaveBeenCalled();
});
it('validates input before mutation and returns a normalized creation result', async () => {
  const { POST } = await import('@/app/api/admin/users/route');
  expect(
    (
      await POST(
        new Request('http://localhost', {
          method: 'POST',
          headers: { origin: 'http://localhost', 'content-type': 'application/json' },
          body: '{',
        }),
      )
    ).status,
  ).toBe(400);
  expect((await POST(request({ email: 1 }))).status).toBe(400);
  expect(mocks.create).not.toHaveBeenCalled();
  const response = await POST(
    request({ email: ' New@example.test ', name: ' New ', company: '', role: 'viewer' }),
  );
  expect(response.status).toBe(200);
  expect(mocks.create).toHaveBeenCalledWith('new@example.test', 'New', 'viewer', undefined, {
    kind: 'session',
    ...admin,
  });
  expect(await response.json()).toMatchObject({
    userId: 'new',
    email: 'new@example.test',
    tempPassword: 'one-time',
    expiresAt: '2099-01-01T00:00:00.000Z',
  });
});
it('returns conflict for duplicate accounts and fails closed on storage errors', async () => {
  const { AccountError } = await import('@/lib/auth/account-errors');
  const { GET, POST } = await import('@/app/api/admin/users/route');
  mocks.create.mockRejectedValue(new AccountError('exists'));
  expect((await POST(request({ email: 'new@example.test' }))).status).toBe(409);
  mocks.create.mockRejectedValue(new Error('offline'));
  expect((await POST(request({ email: 'new@example.test' }))).status).toBe(500);
  expect(mocks.create).toHaveBeenCalledTimes(2);
  mocks.list.mockRejectedValue(new Error('offline'));
  expect((await GET()).status).toBe(500);
});
it('reports concurrent-account conflicts and integrity failures without exposing backend details', async () => {
  const { AccountError } = await import('@/lib/auth/account-errors');
  const { POST } = await import('@/app/api/admin/users/route');
  mocks.create.mockRejectedValue(new AccountError('conflict'));
  expect((await POST(request({ email: 'new@example.test' }))).status).toBe(409);
  mocks.create.mockRejectedValue(new AccountError('integrity'));
  const result = await POST(request({ email: 'new@example.test' }));
  expect(result.status).toBe(500);
  expect(await result.json()).toEqual({ error: 'Account state requires operator attention.' });
});
it('allows forced-password sessions to change only their own verified password', async () => {
  mocks.auth.mockResolvedValue({ user: { ...admin, mustChangePassword: true } });
  mocks.getById.mockResolvedValue({ ...admin, password: 'old-hash' });
  mocks.hash.mockResolvedValue('new-hash');
  mocks.verify.mockResolvedValue(false);
  const { POST } = await import('@/app/api/auth/change-password/route');
  const body = {
    currentPassword: 'wrong',
    newPassword: 'StrongPassword1!',
    userId: 'someone-else',
  };
  expect((await POST(request(body))).status).toBe(400);
  expect(mocks.update).not.toHaveBeenCalled();
  mocks.verify.mockResolvedValueOnce(true).mockResolvedValueOnce(false);
  expect((await POST(request(body))).status).toBe(200);
  expect(mocks.getById).toHaveBeenCalledWith(admin.id);
  expect(mocks.update).toHaveBeenCalledWith({ ...admin, password: 'old-hash' }, 'new-hash', {
    ...admin,
    mustChangePassword: true,
  });
});
it('does not clear the password-change requirement by reusing the existing password', async () => {
  mocks.auth.mockResolvedValue({ user: { ...admin, mustChangePassword: true } });
  mocks.getById.mockResolvedValue({ ...admin, password: 'old-hash', mustChangePassword: true });
  mocks.verify.mockResolvedValue(true);
  const { POST } = await import('@/app/api/auth/change-password/route');
  const response = await POST(
    request({ currentPassword: 'StrongPassword1!', newPassword: 'StrongPassword1!' }),
  );
  expect(response.status).toBe(400);
  expect(await response.json()).toEqual({ error: 'Choose a different password.' });
  expect(mocks.update).not.toHaveBeenCalled();
  expect(mocks.hash).not.toHaveBeenCalled();
});
it('handles reset validation, missing users, successful resets, and storage failure', async () => {
  const { AccountError } = await import('@/lib/auth/account-errors');
  const { POST } = await import('@/app/api/admin/users/reset-password/route');
  expect((await POST(request({ email: 'invalid' }))).status).toBe(400);
  expect(mocks.reset).not.toHaveBeenCalled();
  mocks.reset.mockRejectedValue(new AccountError('not-found'));
  expect((await POST(request({ email: 'a@example.test' }))).status).toBe(404);
  mocks.reset.mockRejectedValue(new Error('offline'));
  expect((await POST(request({ email: 'a@example.test' }))).status).toBe(500);
  mocks.reset.mockResolvedValue({ tempPassword: 'temporary' });
  const result = await POST(request({ email: ' A@example.test ' }));
  expect(result.status).toBe(200);
  expect(await result.json()).toMatchObject({ tempPassword: 'temporary' });
  expect(mocks.reset).toHaveBeenLastCalledWith('a@example.test', { kind: 'session', ...admin });
});
it.each(['viewer', 'user', 'admin'])(
  'accepts the %s role offered by account administration',
  async (role) => {
    const { POST } = await import('@/app/api/admin/users/route');
    expect((await POST(request({ email: 'new@example.test', role }))).status).toBe(200);
    expect(mocks.create).toHaveBeenCalledWith('new@example.test', undefined, role, undefined, {
      kind: 'session',
      ...admin,
    });
  },
);
it('rejects malformed, weak, missing-account and failed password changes', async () => {
  const { POST } = await import('@/app/api/auth/change-password/route');
  expect((await POST(request(null))).status).toBe(400);
  expect((await POST(request({ currentPassword: 'old', newPassword: 'weak' }))).status).toBe(400);
  const body = { currentPassword: 'old', newPassword: 'StrongPassword1!' };
  mocks.getById.mockResolvedValue(null);
  expect((await POST(request(body))).status).toBe(404);
  mocks.getById.mockRejectedValue(new Error('offline'));
  expect((await POST(request(body))).status).toBe(500);
  expect(mocks.update).not.toHaveBeenCalled();
});
it.each(['create', 'reset', 'change'] as const)(
  'rejects a cross-origin simple request to the %s account mutation',
  async (action) => {
    mocks.reset.mockResolvedValue({ tempPassword: 'temporary' });
    mocks.getById.mockResolvedValue({ ...admin, password: 'hash' });
    mocks.verify.mockResolvedValueOnce(true).mockResolvedValueOnce(false);
    mocks.hash.mockResolvedValue('new-hash');
    const route =
      action === 'create'
        ? await import('@/app/api/admin/users/route')
        : action === 'reset'
          ? await import('@/app/api/admin/users/reset-password/route')
          : await import('@/app/api/auth/change-password/route');
    const response = await route.POST(
      new Request('http://localhost/api/account', {
        method: 'POST',
        headers: { origin: 'https://untrusted.example.test', 'content-type': 'text/plain' },
        body: JSON.stringify({
          email: 'new@example.test',
          currentPassword: 'old',
          newPassword: 'StrongNewPassword2!',
        }),
      }),
    );
    expect(response.status).toBe(403);
    for (const mutation of [mocks.create, mocks.reset, mocks.update])
      expect(mutation).not.toHaveBeenCalled();
  },
);

it.each([
  ['unavailable', 503],
  ['configuration', 500],
  ['integrity', 500],
] as const)('denies account operations when viewer resolution reports %s', async (kind, status) => {
  mocks.failure.mockReturnValue(kind);
  const { GET, POST } = await import('@/app/api/admin/users/route');
  expect((await GET()).status).toBe(status);
  expect((await POST(request({ email: 'new@example.test' }))).status).toBe(status);
  expect(mocks.create).not.toHaveBeenCalled();
  expect(mocks.list).not.toHaveBeenCalled();
});
