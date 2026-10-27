// @vitest-environment node
import { it, expect } from 'vitest';
import { accountJson, accountErrorResponse } from '@/lib/auth/account-response';
import { AccountError } from '@/lib/auth/account-errors';

it('prevents storage of account responses while preserving status and unrelated headers', async () => {
  const response = accountJson(
    { message: 'Synthetic account result' },
    {
      status: 201,
      headers: { 'cache-control': 'public, max-age=3600', 'x-request-id': 'fixture' },
    },
  );
  expect(response.status).toBe(201);
  expect(response.headers.get('cache-control')).toBe('private, no-store');
  expect(response.headers.get('x-request-id')).toBe('fixture');
  expect(await response.json()).toEqual({ message: 'Synthetic account result' });
});
it.each([
  ['expired', 401],
  ['not-found', 404],
  ['integrity', 500],
  ['conflict', 409],
] as const)('does not cache %s account failures', (code, status) => {
  const response = accountErrorResponse(new AccountError(code), 'Operation failed');
  expect(response.status).toBe(status);
  expect(response.headers.get('cache-control')).toBe('private, no-store');
});
it('does not expose or cache unclassified account errors', async () => {
  const response = accountErrorResponse(new Error('private error detail'), 'Operation failed');
  expect(response.status).toBe(500);
  expect(response.headers.get('cache-control')).toBe('private, no-store');
  expect(await response.json()).toEqual({ error: 'Operation failed' });
});
