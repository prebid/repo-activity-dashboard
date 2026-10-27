import 'server-only';
import { TransactionCanceledException } from '@aws-sdk/client-dynamodb';
import { setTimeout as sleep } from 'node:timers/promises';
export function isReadConflict(error: unknown): boolean {
  return (
    error instanceof TransactionCanceledException &&
    Boolean(error.CancellationReasons?.some((r) => r.Code === 'TransactionConflict')) &&
    Boolean(
      error.CancellationReasons?.every(
        (r) => r.Code === 'None' || r.Code === 'TransactionConflict',
      ),
    )
  );
}
export async function readWithConflictRetry<T>(
  read: (signal: AbortSignal) => Promise<T>,
  options: { timeoutMs?: number; random?: () => number } = {},
): Promise<T> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), options.timeoutMs ?? 5000);
  let rejectDeadline!: (reason: unknown) => void;
  const deadline = new Promise<never>((_, reject) => {
    rejectDeadline = reject;
  });
  const abort = () =>
    rejectDeadline(new DOMException('Account read aborted or timed out', 'AbortError'));
  controller.signal.addEventListener('abort', abort, { once: true });
  try {
    for (let attempt = 0; ; attempt++) {
      controller.signal.throwIfAborted();
      try {
        return await Promise.race([
          Promise.resolve().then(() => read(controller.signal)),
          deadline,
        ]);
      } catch (error) {
        if (attempt >= 2 || !isReadConflict(error) || controller.signal.aborted) throw error;
        const delay = Math.floor(
          (options.random ?? Math.random)() * Math.min(200, 50 * 2 ** attempt),
        );
        await sleep(delay, undefined, { signal: controller.signal });
      }
    }
  } finally {
    clearTimeout(timer);
    controller.signal.removeEventListener('abort', abort);
  }
}
