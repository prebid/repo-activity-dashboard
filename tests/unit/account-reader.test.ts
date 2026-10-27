// @vitest-environment node
import { it, expect, vi } from 'vitest';
vi.mock('server-only', () => ({}));
import { TransactionCanceledException } from '@aws-sdk/client-dynamodb';
import { readWithConflictRetry, isReadConflict } from '@/lib/auth/account-reader';
const conflict = () =>
  new TransactionCanceledException({
    $metadata: { httpStatusCode: 400 },
    message: 'conflict',
    CancellationReasons: [{ Code: 'TransactionConflict' }, { Code: 'None' }],
  });
it('retries transient read conflicts but not conditional authorization failures', async () => {
  const read = vi.fn().mockRejectedValueOnce(conflict()).mockResolvedValue('current');
  expect(await readWithConflictRetry(read, { random: () => 0 })).toBe('current');
  expect(read).toHaveBeenCalledTimes(2);
  const denied = new TransactionCanceledException({
    $metadata: {},
    message: 'changed',
    CancellationReasons: [{ Code: 'ConditionalCheckFailed' }, { Code: 'TransactionConflict' }],
  });
  expect(isReadConflict(denied)).toBe(false);
  read.mockReset().mockRejectedValue(denied);
  await expect(readWithConflictRetry(read)).rejects.toBe(denied);
  expect(read).toHaveBeenCalledTimes(1);
});
it('bounds attempts and shares the same cancellation deadline', async () => {
  const read = vi.fn().mockRejectedValue(conflict());
  await expect(readWithConflictRetry(read, { random: () => 0 })).rejects.toBeInstanceOf(
    TransactionCanceledException,
  );
  expect(read).toHaveBeenCalledTimes(3);
  const stalled = vi.fn(
    (signal: AbortSignal) =>
      new Promise<never>((_, reject) =>
        signal.addEventListener('abort', () => reject(new Error('aborted')), { once: true }),
      ),
  );
  await expect(readWithConflictRetry(stalled, { timeoutMs: 10 })).rejects.toThrow('aborted');
  expect(stalled).toHaveBeenCalledTimes(1);
});
it('enforces its own deadline even when a dependency ignores cancellation', async () => {
  await expect(
    readWithConflictRetry(() => new Promise(() => {}), { timeoutMs: 10 }),
  ).rejects.toMatchObject({ name: 'AbortError' });
}, 1000);
