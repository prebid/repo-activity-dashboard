import { it, expect } from 'vitest';
import { accountMutationPolicy } from '@/lib/auth/mutation-policy';
const origin = 'https://dashboard.example.test';
it('accepts the configured origin and JSON, including a charset parameter', () => {
  expect(
    accountMutationPolicy(
      new Headers({ origin, 'content-type': 'Application/JSON; charset=utf-8' }),
      origin + '/',
    ),
  ).toEqual({ allowed: true });
});
it.each([
  undefined,
  'null',
  'https://untrusted.example.test',
  'https://dashboard.example.test.attacker.test',
  'http://dashboard.example.test',
  'https://dashboard.example.test:444',
])('rejects an absent or untrusted origin %s', (source) => {
  const headers = new Headers({ 'content-type': 'application/json' });
  if (source) headers.set('origin', source);
  expect(accountMutationPolicy(headers, origin)).toMatchObject({ allowed: false, status: 403 });
});
it.each([
  undefined,
  'text/plain',
  'application/x-www-form-urlencoded',
  'multipart/form-data',
  'application/json, text/plain',
])('rejects non-JSON request type %s', (type) => {
  const headers = new Headers({ origin });
  if (type) headers.set('content-type', type);
  expect(accountMutationPolicy(headers, origin)).toMatchObject({ allowed: false, status: 415 });
});
it('fails closed when the canonical origin is missing', () => {
  expect(
    accountMutationPolicy(new Headers({ origin, 'content-type': 'application/json' }), undefined),
  ).toMatchObject({ allowed: false, status: 503 });
});
