// @vitest-environment node
import { it, expect } from 'vitest';
import { readBoundedBody } from '@/lib/auth/bounded-request';
it('counts actual streamed bytes even without or despite an understated length', async () => {
  for (const headers of [{}, { 'content-length': '1' }]) {
    let canceled = false;
    const body = new ReadableStream<Uint8Array>({
      start(c) {
        c.enqueue(new Uint8Array(5));
        c.enqueue(new Uint8Array(5));
      },
      cancel() {
        canceled = true;
      },
    });
    const request = new Request('http://localhost', {
      method: 'POST',
      headers,
      body,
      duplex: 'half',
    } as RequestInit);
    await expect(readBoundedBody(request, 8)).rejects.toMatchObject({ status: 413 });
    expect(canceled).toBe(true);
  }
});
it('accepts exact byte limits, including multibyte input, and rejects a declared oversize', async () => {
  const data = new TextEncoder().encode('éé');
  expect(
    await readBoundedBody(new Request('http://localhost', { method: 'POST', body: data }), 4),
  ).toEqual(data);
  await expect(
    readBoundedBody(
      new Request('http://localhost', {
        method: 'POST',
        headers: { 'content-length': '100' },
        body: 'x',
      }),
      4,
    ),
  ).rejects.toMatchObject({ status: 413 });
  expect(await readBoundedBody(new Request('http://localhost'))).toHaveLength(0);
});
it('cancels stalled and disconnected streams instead of retaining the reader', async () => {
  for (const aborted of [false, true]) {
    let canceled = false;
    const controller = new AbortController();
    const body = new ReadableStream<Uint8Array>({
      cancel() {
        canceled = true;
      },
    });
    const request = new Request('http://localhost', {
      method: 'POST',
      body,
      signal: controller.signal,
      duplex: 'half',
    } as RequestInit);
    if (aborted) controller.abort();
    await expect(readBoundedBody(request, 8, 10)).rejects.toMatchObject({ status: 408 });
    expect(canceled).toBe(true);
  }
});
it('does not let a cancellation failure mask the original body-limit failure', async () => {
  const body = new ReadableStream<Uint8Array>({
    start(c) {
      c.enqueue(new Uint8Array(10));
    },
    cancel() {
      return Promise.reject(new Error('cancel failed'));
    },
  });
  const request = new Request('http://localhost', {
    method: 'POST',
    body,
    duplex: 'half',
  } as RequestInit);
  await expect(readBoundedBody(request, 4)).rejects.toMatchObject({ status: 413 });
  const declared = new ReadableStream<Uint8Array>({
    cancel() {
      return Promise.reject(new Error('cancel failed'));
    },
  });
  await expect(
    readBoundedBody(
      new Request('http://localhost', {
        method: 'POST',
        headers: { 'content-length': '100' },
        body: declared,
        duplex: 'half',
      } as RequestInit),
      4,
    ),
  ).rejects.toMatchObject({ status: 413 });
});
