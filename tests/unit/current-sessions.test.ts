import { it, expect } from 'vitest';
import { currentIdentity } from '@/lib/auth/session-policy';
const user = {
  id: 'one',
  email: 'one@example.test',
  password: 'private-hash',
  role: 'admin',
  authVersion: 3,
  createdAt: '',
  updatedAt: '',
  mustChangePassword: false,
  temporaryPasswordExpiresAt: '2099-01-01T00:00:00.000Z',
};
const access = { email: user.email, userId: user.id, role: 'admin', isActive: true };
const claims = { id: user.id, email: user.email, authVersion: 3 };
it('uses the current identity and the intersection of account and whitelist roles', () => {
  expect(currentIdentity(claims, { user, access })).toMatchObject({
    role: 'admin',
    authVersion: 3,
  });
  expect(
    currentIdentity(claims, {
      user: { ...user, role: 'viewer', mustChangePassword: true },
      access,
    }),
  ).toMatchObject({ role: 'viewer', mustChangePassword: true });
  expect(currentIdentity(claims, { user, access: { ...access, role: 'user' } })).toMatchObject({
    role: 'user',
  });
  expect(currentIdentity(claims, { user, access })).not.toHaveProperty('password');
});
it.each([
  { claims: { id: user.id, email: user.email }, user, access },
  { claims: { ...claims, authVersion: 2 }, user, access },
  { claims, user: undefined, access },
  { claims, user, access: undefined },
  { claims, user, access: { ...access, isActive: false } },
  { claims, user, access: { ...access, userId: 'other' } },
  { claims, user: { ...user, id: 'other' }, access },
  { claims, user: { ...user, email: 'other@example.test' }, access },
  { claims, user, access: { ...access, email: 'other@example.test' } },
])('rejects revoked, pre-upgrade, mismatched and malformed identities %#', (input) => {
  expect(currentIdentity(input.claims, { user: input.user, access: input.access })).toBeNull();
});
it('allows fresh logins for legacy records with no version or email link', () => {
  const { authVersion: _version, ...legacy } = user;
  const { userId: _id, ...legacyAccess } = access;
  expect(
    currentIdentity({ ...claims, authVersion: 0 }, { user: legacy, access: legacyAccess }),
  ).toMatchObject({ id: 'one', authVersion: 0 });
});

it('separates corrupted account data from revoked access', () => {
  expect(() =>
    currentIdentity(claims, { user: { ...user, role: 'invented-role' }, access }),
  ).toThrow('operator attention');
  expect(() => currentIdentity(claims, { user, access: { ...access, isActive: 'yes' } })).toThrow(
    'operator attention',
  );
});
