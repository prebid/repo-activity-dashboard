// @vitest-environment node
import { it, expect, vi } from 'vitest';
import { createServer, IncomingMessage } from 'node:http';
import { text as readText } from 'node:stream/consumers';
import { NodeHttpHandler } from '@smithy/node-http-handler';
import { HttpRequest } from '@smithy/core/protocols';
import { awsClientPolicy } from '@/lib/aws/client-policy';
vi.mock('server-only', () => ({}));
vi.mock('@/lib/auth/runtime-settings', () => import('../fakes/runtime-settings'));

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
    ).rejects.toMatchObject({ name: 'TimeoutError', code: 'ETIMEDOUT' });
    expect(received).toBe(true);
  } finally {
    handler.destroy();
    server.closeAllConnections();
    await new Promise<void>((resolve) => server.close(() => resolve()));
  }
}, 10000);

it('terminates an inactive response body after headers have arrived', async () => {
  const server = createServer((_request, response) => {
    response.writeHead(200, { 'content-type': 'application/json' });
    response.write('{');
  });
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  const address = server.address();
  if (!address || typeof address === 'string') throw new Error('Missing local test port');
  const handler = new NodeHttpHandler(awsClientPolicy.requestHandler);
  let watchdog: ReturnType<typeof setTimeout> | undefined;
  try {
    const { response } = await handler.handle(
      new HttpRequest({
        protocol: 'http:',
        hostname: '127.0.0.1',
        port: address.port,
        method: 'GET',
        path: '/',
      }),
    );
    expect(response.statusCode).toBe(200);
    if (!(response.body instanceof IncomingMessage)) throw new Error('Expected a real HTTP body');
    const deadline = new Promise<string>((resolve) => {
      watchdog = setTimeout(() => resolve('test-watchdog-fired'), 7000);
    });
    await expect(Promise.race([readText(response.body), deadline])).rejects.toMatchObject({
      code: 'ECONNRESET',
    });
    expect(response.body.aborted).toBe(true);
  } finally {
    clearTimeout(watchdog);
    handler.destroy();
    server.closeAllConnections();
    await new Promise<void>((resolve) => server.close(() => resolve()));
  }
}, 10000);

it('bounds a signing-key response that stalls after headers and permits a fresh load', async () => {
  let stalled = true;
  let requests = 0;
  const key = 'recovered-local-signing-key-with-more-than-32-characters';
  const server = createServer((_request, response) => {
    requests++;
    response.writeHead(200, { 'content-type': 'application/x-amz-json-1.1' });
    if (stalled) response.write('{"SecretString":');
    else response.end(JSON.stringify({ SecretString: key }));
  });
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  const address = server.address();
  if (!address || typeof address === 'string') throw new Error('Missing local test port');
  vi.stubEnv('NEXT_PUBLIC_APP_MODE', 'production');
  vi.stubEnv(
    'DASHBOARD_AUTH_SECRET_ARN',
    'arn:aws:secretsmanager:us-east-2:123456789012:secret:fixture',
  );
  vi.stubEnv('AWS_ENDPOINT_URL_SECRETS_MANAGER', `http://127.0.0.1:${address.port}`);
  let watchdog: ReturnType<typeof setTimeout> | undefined;
  try {
    const { getSecret } = await import('@/lib/auth/get-secret');
    // This independent watchdog is a test failure, never an accepted application timeout.
    const deadline = new Promise<string>((resolve) => {
      watchdog = setTimeout(() => resolve('test-watchdog-fired'), 7000);
    });
    await expect(Promise.race([getSecret(), deadline])).rejects.toMatchObject({
      kind: 'unavailable',
    });
    expect(requests).toBeGreaterThanOrEqual(1);
    expect(requests).toBeLessThanOrEqual(2);
    const attempts = requests;
    stalled = false;
    expect(await getSecret()).toBe(key);
    expect(requests).toBe(attempts + 1);
  } finally {
    clearTimeout(watchdog);
    server.closeAllConnections();
    await new Promise<void>((resolve) => server.close(() => resolve()));
    vi.unstubAllEnvs();
  }
}, 15000);
