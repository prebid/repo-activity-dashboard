import { it, expect } from 'vitest';
import {
  temporaryCredentialCurrent,
  temporaryPasswordHoursSchema,
  temporaryExpirySchema,
} from '@/models/temporary-credentials';
import { credentialSchema } from '@/models/accounts';
it('has a bounded configurable lifetime and a canonical persisted expiry', () => {
  expect(temporaryPasswordHoursSchema.parse(undefined)).toBe(24);
  expect(temporaryPasswordHoursSchema.parse('48')).toBe(48);
  for (const value of [0, 169, 1.5, '', null, 'bad'])
    expect(temporaryPasswordHoursSchema.safeParse(value).success).toBe(false);
  for (const value of ['bad', '2026-10-27', '2026-10-27T00:00:00Z'])
    expect(temporaryExpirySchema.safeParse(value).success).toBe(false);
  expect(temporaryExpirySchema.parse('2026-10-27T00:00:00.000Z')).toBe('2026-10-27T00:00:00.000Z');
});
it('expires at the exact boundary and requires reissue for legacy temporary credentials', () => {
  const user = { mustChangePassword: true, temporaryPasswordExpiresAt: '2026-10-27T00:00:00.000Z' },
    expiry = Date.parse(user.temporaryPasswordExpiresAt);
  expect(temporaryCredentialCurrent(user, expiry - 1)).toBe(true);
  expect(temporaryCredentialCurrent(user, expiry)).toBe(false);
  expect(temporaryCredentialCurrent(user, expiry + 1)).toBe(false);
  expect(temporaryCredentialCurrent({ mustChangePassword: true }, expiry)).toBe(false);
  expect(temporaryCredentialCurrent({ mustChangePassword: false }, expiry)).toBe(true);
});
it('bounds verification by UTF-8 bytes without trimming or truncating', () => {
  const input = { email: 'a@example.test', password: 'é'.repeat(512) };
  expect(credentialSchema.parse(input).password).toBe(input.password);
  expect(credentialSchema.safeParse({ ...input, password: input.password + 'é' }).success).toBe(
    false,
  );
  expect(credentialSchema.parse({ ...input, password: ' password ' }).password).toBe(' password ');
});
