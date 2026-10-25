// @vitest-environment node
import { beforeEach, afterEach, it, expect, vi } from 'vitest';
const mocks = vi.hoisted(() => ({
  auth: vi.fn(),
  find: vi.fn(),
  create: vi.fn(),
  list: vi.fn(),
  reset: vi.fn(),
  getById: vi.fn(),
  update: vi.fn(),
  verify: vi.fn(),
  hash: vi.fn(),
}));
vi.mock('@/lib/auth/auth', () => ({ auth: mocks.auth }));
vi.mock('@/lib/auth/users', () => ({
  getUserByEmail: mocks.find,
  adminCreateUser: mocks.create,
  adminResetPassword: mocks.reset,
  getUserById: mocks.getById,
  updateUserPassword: mocks.update,
}));
vi.mock('@/lib/auth/whitelist', () => ({ getAllWhitelistedEmails: mocks.list }));
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
};
const request = (body: unknown) =>
  new Request('http://localhost/api/admin/users', { method: 'POST', body: JSON.stringify(body) });
beforeEach(() => {
  vi.resetAllMocks();
  vi.resetModules();
  vi.stubEnv('NEXT_PUBLIC_APP_MODE', 'production');
  mocks.auth.mockResolvedValue({ user: admin });
  mocks.find.mockResolvedValue(null);
  mocks.create.mockResolvedValue({
    user: { id: 'new', email: 'new@example.test' },
    tempPassword: 'one-time',
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
  expect((await POST(new Request('http://localhost', { method: 'POST', body: '{' }))).status).toBe(
    400,
  );
  expect((await POST(request({ email: 1 }))).status).toBe(400);
  expect(mocks.create).not.toHaveBeenCalled();
  const response = await POST(
    request({ email: ' New@example.test ', name: ' New ', company: '', role: 'viewer' }),
  );
  expect(response.status).toBe(200);
  expect(mocks.create).toHaveBeenCalledWith(
    'new@example.test',
    'New',
    'viewer',
    undefined,
    admin.email,
  );
  expect(await response.json()).toMatchObject({
    userId: 'new',
    email: 'new@example.test',
    tempPassword: 'one-time',
  });
});
it('returns conflict for duplicate accounts and fails closed on storage errors', async () => {
  const { GET, POST } = await import('@/app/api/admin/users/route');
  mocks.find.mockResolvedValue({ id: 'existing' });
  expect((await POST(request({ email: 'new@example.test' }))).status).toBe(409);
  mocks.find.mockRejectedValue(new Error('offline'));
  expect((await POST(request({ email: 'new@example.test' }))).status).toBe(500);
  expect(mocks.create).not.toHaveBeenCalled();
  mocks.list.mockRejectedValue(new Error('offline'));
  expect((await GET()).status).toBe(500);
});
it('allows forced-password sessions to change only their own verified password', async () => {
  mocks.auth.mockResolvedValue({ user: { ...admin, mustChangePassword: true } });
  mocks.getById.mockResolvedValue({ id: admin.id, password: 'old-hash' });
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
  mocks.verify.mockResolvedValue(true);
  expect((await POST(request(body))).status).toBe(200);
  expect(mocks.getById).toHaveBeenCalledWith(admin.id);
  expect(mocks.update).toHaveBeenCalledWith(admin.id, 'new-hash');
});
it('handles reset validation, missing users, successful resets, and storage failure', async () => {
  const { POST } = await import('@/app/api/admin/users/reset-password/route');
  expect((await POST(request({ email: 'invalid' }))).status).toBe(400);
  expect(mocks.reset).not.toHaveBeenCalled();
  mocks.reset.mockRejectedValue(new Error('User not found'));
  expect((await POST(request({ email: 'a@example.test' }))).status).toBe(404);
  mocks.reset.mockRejectedValue(new Error('offline'));
  expect((await POST(request({ email: 'a@example.test' }))).status).toBe(500);
  mocks.reset.mockResolvedValue({ tempPassword: 'temporary' });
  const result = await POST(request({ email: ' A@example.test ' }));
  expect(result.status).toBe(200);
  expect(await result.json()).toMatchObject({ tempPassword: 'temporary' });
  expect(mocks.reset).toHaveBeenLastCalledWith('a@example.test');
});
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
