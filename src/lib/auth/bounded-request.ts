export const MAX_AUTH_BODY_BYTES = 16 * 1024;
export class RequestBodyError extends Error {
  constructor(public readonly status: 408 | 413) {
    super(
      status === 413 ? 'Request body is too large.' : 'Request body was not completed in time.',
    );
  }
}
export async function readBoundedBody(
  request: Request,
  limit = MAX_AUTH_BODY_BYTES,
  timeoutMs = 5000,
): Promise<Uint8Array<ArrayBuffer>> {
  const length = Number(request.headers.get('content-length'));
  if (length > limit) {
    void request.body?.cancel().catch(() => {});
    throw new RequestBodyError(413);
  }
  if (!request.body) return new Uint8Array();
  const reader = request.body.getReader();
  let abort!: () => void;
  let timer: ReturnType<typeof setTimeout> | undefined;
  const interrupted = new Promise<never>((_, reject) => {
    abort = () => reject(new RequestBodyError(408));
    timer = setTimeout(abort, timeoutMs);
    request.signal.addEventListener('abort', abort, { once: true });
    if (request.signal.aborted) abort();
  });
  const chunks: Uint8Array[] = [];
  let total = 0,
    complete = false;
  try {
    for (;;) {
      const { value, done } = await Promise.race([reader.read(), interrupted]);
      if (done) {
        complete = true;
        break;
      }
      total += value.byteLength;
      if (total > limit) throw new RequestBodyError(413);
      chunks.push(value);
    }
    const result = new Uint8Array(total);
    let offset = 0;
    for (const chunk of chunks) {
      result.set(chunk, offset);
      offset += chunk.byteLength;
    }
    return result;
  } finally {
    clearTimeout(timer);
    request.signal.removeEventListener('abort', abort);
    if (!complete) void reader.cancel().catch(() => {});
    reader.releaseLock();
  }
}
