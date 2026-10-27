// @vitest-environment node
import { it, expect } from 'vitest';
import { createServer } from 'node:http';
import { NodeHttpHandler } from '@smithy/node-http-handler';
import { HttpRequest } from '@smithy/core/protocols';
import { awsClientPolicy } from '@/lib/aws/client-policy';

it('fails a connected request that never receives a response', async () => {
  let received = false;
  const server = createServer(() => {
    received = true;
  });
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  const address = server.address();
  if (!address || typeof address === 'string') throw new Error('Missing local test port');
  const handler = new NodeHttpHandler(awsClientPolicy.requestHandler);
  try {
    await expect(
      handler.handle(
        new HttpRequest({
          protocol: 'http:',
          hostname: '127.0.0.1',
          port: address.port,
          method: 'GET',
          path: '/',
        }),
        {
          abortSignal: AbortSignal.timeout(8000),
        },
      ),
    ).rejects.toMatchObject({ name: 'TimeoutError' });
    expect(received).toBe(true);
  } finally {
    handler.destroy();
    server.closeAllConnections();
    await new Promise<void>((resolve) => server.close(() => resolve()));
  }
}, 10000);
