// @vitest-environment node
import { describe, it, expect, vi } from 'vitest';
import { authorizeCredentials } from '@/lib/auth/credential-policy';
import { accountAccess } from '@/lib/auth/access-policy';
import { readRequestBody } from '@/lib/auth/request-body';
import { readJsonResponse, mutationFailureMessage } from '@/lib/presentation/http';
import { createAccountSchema, messageResponseSchema } from '@/models/accounts';

const account = {
  id: 'person-1',
  email: 'a@example.test',
  password: 'private-hash',
  role: 'admin' as const,
  authVersion: 0,
  mustChangePassword: true,
  temporaryPasswordExpiresAt: '2099-01-01T00:00:00.000Z',
  createdAt: '',
  updatedAt: '',
};
function dependencies() {
  return {
    lookup: vi.fn().mockResolvedValue({
      user: account,
      access: { email: account.email, userId: account.id, role: 'admin', isActive: true },
    }),
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
    expect(deps.lookup).toHaveBeenCalledExactlyOnceWith('a@example.test');
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
    expect(deps.lookup).not.toHaveBeenCalled();
  });
  it('checks disallowed accounts with the same verification work', async () => {
    const deps = dependencies();
    deps.lookup.mockResolvedValue({
      user: account,
      access: { email: account.email, userId: account.id, role: 'admin', isActive: false },
    });
    expect(await authorizeCredentials({ email: account.email, password: 'x' }, deps)).toBeNull();
    expect(deps.lookup).toHaveBeenCalledOnce();
    expect(deps.verify).toHaveBeenCalledTimes(1);
  });
  it('refuses missing accounts and incorrect passwords', async () => {
    const deps = dependencies();
    deps.lookup.mockResolvedValue({ user: null, access: null });
    expect(await authorizeCredentials({ email: account.email, password: 'x' }, deps)).toBeNull();
    expect(deps.verify).toHaveBeenCalledTimes(1);
    expect(deps.verify.mock.calls[0][1]).not.toBe(account.password);
    deps.lookup.mockResolvedValue({
      user: account,
      access: { email: account.email, userId: account.id, role: 'admin', isActive: true },
    });
    deps.verify.mockResolvedValue(false);
    expect(await authorizeCredentials({ email: account.email, password: 'x' }, deps)).toBeNull();
  });
  it('propagates store failure instead of pretending the account is absent', async () => {
    const deps = dependencies();
    deps.lookup.mockRejectedValue(new Error('offline'));
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

it('reveals temporary expiry only after a valid credential for an active linked account', async () => {
  const deps = dependencies();
  const expired = { ...account, temporaryPasswordExpiresAt: '2020-01-01T00:00:00.000Z' };
  const access = { email: account.email, userId: account.id, role: 'admin', isActive: true };
  deps.lookup.mockResolvedValue({ user: expired, access });
  await expect(
    authorizeCredentials({ email: account.email, password: 'valid' }, deps),
  ).rejects.toMatchObject({ code: 'expired' });
  deps.verify.mockResolvedValue(false);
  expect(await authorizeCredentials({ email: account.email, password: 'wrong' }, deps)).toBeNull();
  deps.verify.mockResolvedValue(true);
  deps.lookup.mockResolvedValue({ user: expired, access: { ...access, isActive: false } });
  expect(await authorizeCredentials({ email: account.email, password: 'valid' }, deps)).toBeNull();
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

it('returns a body-size error before parsing an account mutation', async () => {
  const result = await readRequestBody(
    new Request('http://localhost', { method: 'POST', body: 'x'.repeat(17000) }),
    createAccountSchema,
  );
  expect(result.ok).toBe(false);
  if (result.ok) throw new Error('Expected oversized rejection');
  expect(result.response.status).toBe(413);
});

it.each([400, 500])(
  'distinguishes a rejected mutation from an unknown %i outcome',
  async (status) => {
    let failure: unknown;
    try {
      await readJsonResponse(
        Response.json({ error: 'server detail' }, { status }),
        messageResponseSchema,
        'could not confirm',
      );
    } catch (error) {
      failure = error;
    }
    expect(mutationFailureMessage(failure, 'may have committed')).toBe(
      status === 400 ? 'server detail' : 'may have committed',
    );
  },
);

it('accepts an existing temporary credential without requiring an expiry migration', async () => {
  const deps = dependencies();
  const snapshot = {
    user: { ...account, temporaryPasswordExpiresAt: undefined },
    access: { email: account.email, userId: account.id, role: 'admin', isActive: true },
    legacy: true,
  };
  deps.lookup.mockResolvedValue(snapshot);
  expect(
    await authorizeCredentials({ email: account.email, password: 'valid' }, deps),
  ).toMatchObject({ mustChangePassword: true });
  deps.lookup.mockResolvedValue({
    ...snapshot,
    user: { ...snapshot.user, temporaryPasswordExpiresAt: '2000-01-01T00:00:00.000Z' },
  });
  await expect(
    authorizeCredentials({ email: account.email, password: 'valid' }, deps),
  ).rejects.toMatchObject({ code: 'expired' });
});
