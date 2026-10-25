// @vitest-environment node
import { describe, it, expect, vi } from 'vitest';
import { authorizeCredentials } from '@/lib/auth/credential-policy';
import { accountAccess } from '@/lib/auth/access-policy';
import { readRequestBody } from '@/lib/auth/request-body';
import { readJsonResponse } from '@/lib/presentation/http';
import { createAccountSchema, messageResponseSchema } from '@/models/accounts';

const account = {
  id: 'person-1',
  email: 'a@example.test',
  password: 'private-hash',
  role: 'admin' as const,
  authVersion: 0,
  mustChangePassword: true,
  createdAt: '',
  updatedAt: '',
};
function dependencies() {
  return {
    isAllowed: vi.fn().mockResolvedValue(true),
    findByEmail: vi.fn().mockResolvedValue(account),
    verify: vi.fn().mockResolvedValue(true),
  };
}
describe('production credential policy', () => {
  it('normalizes email and returns identity without the password hash', async () => {
    const deps = dependencies();
    const user = await authorizeCredentials(
      { email: ' A@example.test ', password: 'secret' },
      deps,
    );
    expect(deps.isAllowed).toHaveBeenCalledWith('a@example.test');
    expect(deps.findByEmail).toHaveBeenCalledWith('a@example.test');
    expect(deps.verify).toHaveBeenCalledWith('secret', 'private-hash');
    expect(user).toMatchObject({ id: 'person-1', role: 'admin', mustChangePassword: true });
    expect(user).not.toHaveProperty('password');
  });
  it.each([
    null,
    {},
    { email: 'invalid', password: 'x' },
    { email: 'a@example.test', password: 1 },
  ])('refuses malformed credentials %j before storage', async (input) => {
    const deps = dependencies();
    expect(await authorizeCredentials(input, deps)).toBeNull();
    expect(deps.isAllowed).not.toHaveBeenCalled();
  });
  it('refuses disallowed accounts before reading users', async () => {
    const deps = dependencies();
    deps.isAllowed.mockResolvedValue(false);
    expect(await authorizeCredentials({ email: account.email, password: 'x' }, deps)).toBeNull();
    expect(deps.findByEmail).not.toHaveBeenCalled();
  });
  it('refuses missing accounts and incorrect passwords', async () => {
    const deps = dependencies();
    deps.findByEmail.mockResolvedValue(null);
    expect(await authorizeCredentials({ email: account.email, password: 'x' }, deps)).toBeNull();
    expect(deps.verify).not.toHaveBeenCalled();
    deps.findByEmail.mockResolvedValue(account);
    deps.verify.mockResolvedValue(false);
    expect(await authorizeCredentials({ email: account.email, password: 'x' }, deps)).toBeNull();
  });
  it('propagates store failure instead of pretending the account is absent', async () => {
    const deps = dependencies();
    deps.isAllowed.mockRejectedValue(new Error('offline'));
    await expect(
      authorizeCredentials({ email: account.email, password: 'x' }, deps),
    ).rejects.toThrow('offline');
  });
});
describe('account access', () => {
  it('denies preview, anonymous, non-admin, and password-change restricted sessions', () => {
    expect(accountAccess(account, { preview: true })).toMatchObject({
      allowed: false,
      status: 403,
    });
    expect(accountAccess(null, { preview: false })).toMatchObject({ allowed: false, status: 401 });
    expect(
      accountAccess(
        { ...account, role: 'viewer', mustChangePassword: false },
        { preview: false, admin: true },
      ),
    ).toMatchObject({ allowed: false, status: 403 });
    expect(accountAccess(account, { preview: false, admin: true })).toMatchObject({
      allowed: false,
      error: 'Password change required',
    });
  });
  it('allows changing the required password and authorized admin operations', () => {
    expect(accountAccess(account, { preview: false, allowPasswordChange: true }).allowed).toBe(
      true,
    );
    expect(
      accountAccess({ ...account, mustChangePassword: false }, { preview: false, admin: true })
        .allowed,
    ).toBe(true);
  });
});
describe('JSON boundaries', () => {
  it.each(['{', 'null', '{"email":7}', '{"email":"a@example.test","role":"owner"}'])(
    'rejects invalid requests %s with 400',
    async (body) => {
      const result = await readRequestBody(
        new Request('http://localhost', { method: 'POST', body }),
        createAccountSchema,
      );
      expect(result.ok).toBe(false);
      if (!result.ok) expect(result.response.status).toBe(400);
    },
  );
  it('normalizes valid create requests, supplies defaults, and drops unknown properties', async () => {
    const result = await readRequestBody(
      new Request('http://localhost', {
        method: 'POST',
        body: JSON.stringify({ email: ' A@example.test ', name: '', elevated: true }),
      }),
      createAccountSchema,
    );
    expect(result).toEqual({
      ok: true,
      data: { email: 'a@example.test', name: undefined, role: 'viewer' },
    });
  });
  it('checks successful response shape and handles malformed/error responses', async () => {
    expect(
      await readJsonResponse(Response.json({ message: 'ok' }), messageResponseSchema, 'failed'),
    ).toEqual({ message: 'ok' });
    await expect(
      readJsonResponse(Response.json({ message: 42 }), messageResponseSchema, 'failed'),
    ).rejects.toThrow('unexpected response');
    await expect(
      readJsonResponse(new Response('not JSON'), messageResponseSchema, 'failed'),
    ).rejects.toThrow('failed');
    await expect(
      readJsonResponse(
        Response.json({ error: 'denied' }, { status: 403 }),
        messageResponseSchema,
        'failed',
      ),
    ).rejects.toThrow('denied');
    await expect(
      readJsonResponse(Response.json({}, { status: 500 }), messageResponseSchema, 'failed'),
    ).rejects.toThrow('failed');
  });
});
