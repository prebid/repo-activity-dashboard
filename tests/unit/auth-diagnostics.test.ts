import { it, expect } from 'vitest';
import { safeErrorCode } from '@/lib/auth/diagnostics';
import { MigrationInterruptedError, AccountError } from '@/lib/auth/account-errors';
it('finds safe codes through Error.cause and Auth.js cause.err without leaking messages', () => {
  const cause = Object.assign(new Error('secret-canary'), { name: 'CredentialsProviderError' });
  const wrapped = Object.assign(new Error('private-wrapper'), {
    type: 'CallbackRouteError',
    cause: { err: cause },
  });
  expect(safeErrorCode(wrapped)).toBe('CredentialsProviderError');
  expect(safeErrorCode(new Error('secret-canary'))).toBe('Unknown');
  expect(safeErrorCode('AccessDeniedException')).toBe('Unknown');
  expect(
    safeErrorCode(
      new MigrationInterruptedError(
        [],
        [],
        Object.assign(new Error(), { name: 'AccessDeniedException' }),
      ),
    ),
  ).toBe('AccessDeniedException');
  expect(safeErrorCode(new MigrationInterruptedError([], [], new AccountError('conflict')))).toBe(
    'conflict',
  );
});
it('bounds cyclic causes and accepts only recognized codes', () => {
  const error = Object.assign(new Error(), { code: 'private-code', name: 'TimeoutError' });
  error.cause = error;
  expect(safeErrorCode(error)).toBe('TimeoutError');
});
