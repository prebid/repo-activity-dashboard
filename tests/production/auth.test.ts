// @vitest-environment node
import { it, expect, inject } from 'vitest';
import { mkdtemp, cp, symlink, writeFile, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { createServer } from 'node:http';
import { createServer as createPortServer } from 'node:net';
import { spawn } from 'node:child_process';
import { setTimeout } from 'node:timers/promises';
import { DynamoDBClient, CreateTableCommand } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, PutCommand, GetCommand } from '@aws-sdk/lib-dynamodb';
import { z } from 'zod';
import { hashPassword, verifyPassword } from '@/lib/auth/passwords';
import { writeRuntimeSettings } from '../../scripts/runtime-settings.mjs';

it('runs the production artifact with packaged non-secret configuration, IAM SDK boundaries, current sessions, and protected account APIs', async () => {
  expect((await readFile('.next/dashboard-mode', 'utf8')).trim()).toBe('production');
  const endpoint = inject('accountEndpoint');
  const client = DynamoDBDocumentClient.from(
    new DynamoDBClient({
      endpoint,
      region: 'us-east-2',
      credentials: { accessKeyId: 'local', secretAccessKey: 'local' },
    }),
  );
  const users = 'production-users',
    whitelist = 'production-whitelist';
  for (const [TableName, key] of [
    [users, 'id'],
    [whitelist, 'email'],
  ])
    await client.send(
      new CreateTableCommand({
        TableName,
        KeySchema: [{ AttributeName: key, KeyType: 'HASH' }],
        AttributeDefinitions: [{ AttributeName: key, AttributeType: 'S' }],
        BillingMode: 'PAY_PER_REQUEST',
      }),
    );
  const password = 'StrongTestPassword1!';
  await client.send(
    new PutCommand({
      TableName: users,
      Item: {
        id: 'admin',
        email: 'admin@example.test',
        password: await hashPassword(password),
        role: 'admin',
        authVersion: 1,
        mustChangePassword: false,
        createdAt: 'test',
        updatedAt: 'test',
      },
    }),
  );
  await client.send(
    new PutCommand({
      TableName: whitelist,
      Item: { email: 'admin@example.test', userId: 'admin', role: 'admin', isActive: true },
    }),
  );
  const secret = 'production-smoke-secret-from-managed-service-only';
  const arn = 'arn:aws:secretsmanager:us-east-2:123456789012:secret:smoke-auth';
  let secretReads = 0;
  const secretServer = createServer((request, response) => {
    if (
      request.headers['x-amz-target'] !== 'secretsmanager.GetSecretValue' ||
      !request.headers.authorization?.includes('Credential=local/')
    ) {
      response.writeHead(400);
      response.end('{}');
      return;
    }
    secretReads++;
    response.writeHead(200, { 'content-type': 'application/x-amz-json-1.1' });
    response.end(
      JSON.stringify({ ARN: arn, SecretString: JSON.stringify({ authSecret: secret }) }),
    );
  });
  await new Promise<void>((resolve) => secretServer.listen(0, '127.0.0.1', resolve));
  const secretAddress = secretServer.address();
  if (!secretAddress || typeof secretAddress === 'string')
    throw new Error('No secret fixture port');
  const portServer = createPortServer();
  await new Promise<void>((resolve) => portServer.listen(0, '127.0.0.1', resolve));
  const address = portServer.address();
  if (!address || typeof address === 'string') throw new Error('No application port');
  const port = address.port;
  await new Promise<void>((resolve, reject) =>
    portServer.close((error) => (error ? reject(error) : resolve())),
  );
  const root = await mkdtemp(join(tmpdir(), 'dashboard-production-'));
  let child: ReturnType<typeof spawn> | undefined;
  let output = '';
  try {
    await cp('.next', join(root, '.next'), {
      recursive: true,
      filter: (path) => !path.includes('/.next/cache'),
    });
    await symlink(resolve('node_modules'), join(root, 'node_modules'), 'dir');
    await writeFile(join(root, 'package.json'), '{"type":"module"}\n');
    // No source tree, root manifest, or .env is copied. Configuration is read
    // from the packaged server path using the same allowlisted writer.
    await writeRuntimeSettings(
      {
        AWS_APP_ID: 'smoke',
        AWS_REGION: 'us-east-2',
        DYNAMODB_USERS_TABLE: users,
        DYNAMODB_WHITELIST_TABLE: whitelist,
        AUTH_URL: 'https://dashboard.example.test',
        DASHBOARD_AUTH_SECRET_ARN: arn,
      },
      join(root, '.next/server/dashboard-runtime.json'),
    );
    const environment: NodeJS.ProcessEnv = { ...process.env };
    for (const key of Object.keys(environment))
      if (/^(AWS_|S3_|DYNAMODB_|AUTH_|NEXTAUTH_|AMPLIFY_|NEXT_PUBLIC_|DASHBOARD_)/.test(key))
        delete environment[key];
    Object.assign(environment, {
      NODE_ENV: 'production',
      NEXT_TELEMETRY_DISABLED: '1',
      AWS_ACCESS_KEY_ID: 'local',
      AWS_SECRET_ACCESS_KEY: 'local',
      AWS_EC2_METADATA_DISABLED: 'true',
      AWS_ENDPOINT_URL_DYNAMODB: endpoint,
      AWS_ENDPOINT_URL_SECRETS_MANAGER: 'http://127.0.0.1:' + secretAddress.port,
    });
    child = spawn(
      process.execPath,
      [
        resolve('node_modules/next/dist/bin/next'),
        'start',
        '--hostname',
        '127.0.0.1',
        '--port',
        String(port),
      ],
      { cwd: root, env: environment, stdio: ['ignore', 'pipe', 'pipe'] },
    );
    child.stdout?.on('data', (chunk: Buffer) => {
      output += chunk.toString();
    });
    child.stderr?.on('data', (chunk: Buffer) => {
      output += chunk.toString();
    });
    const origin = 'http://127.0.0.1:' + port;
    let ready = false;
    for (let i = 0; i < 120; i++) {
      if (child.exitCode !== null) throw new Error('Production server failed: ' + output);
      try {
        if ((await fetch(origin + '/api/health')).ok) {
          ready = true;
          break;
        }
      } catch {}
      await setTimeout(250);
    }
    expect(ready, output).toBe(true);
    expect((await fetch(origin + '/api/auth/setup', { method: 'POST', body: '{}' })).status).toBe(
      403,
    );
    const jar = new Map<string, string>();
    function accept(response: Response) {
      for (const raw of response.headers.getSetCookie()) {
        const value = raw.split(';')[0];
        const split = value.indexOf('=');
        jar.set(value.slice(0, split), value.slice(split + 1));
      }
    }
    const cookie = () => [...jar].map(([k, v]) => k + '=' + v).join('; ');
    const csrf = await fetch(origin + '/api/auth/csrf');
    expect(csrf.status).toBe(200);
    accept(csrf);
    const token = z.object({ csrfToken: z.string() }).parse(await csrf.json());
    const login = await fetch(origin + '/api/auth/callback/credentials', {
      method: 'POST',
      redirect: 'manual',
      headers: { cookie: cookie(), 'content-type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        email: 'admin@example.test',
        password,
        csrfToken: token.csrfToken,
        callbackUrl: 'https://dashboard.example.test/repos',
      }),
    });
    expect(login.headers.get('location')).toBe('https://dashboard.example.test/repos');
    accept(login);
    const session = await fetch(origin + '/api/auth/session', { headers: { cookie: cookie() } });
    const identity: unknown = await session.json();
    expect(identity).toMatchObject({ user: { id: 'admin', role: 'admin', authVersion: 1 } });
    expect(JSON.stringify(identity)).not.toContain(secret);
    expect(secretReads).toBeGreaterThan(0);
    const created = await fetch(origin + '/api/admin/users', {
      method: 'POST',
      headers: { cookie: cookie(), 'content-type': 'application/json' },
      body: JSON.stringify({ email: 'new@example.test', role: 'user' }),
    });
    expect(created.status, output).toBe(200);
    const result = z
      .object({ userId: z.string(), tempPassword: z.string() })
      .parse(await created.json());
    const stored = await client.send(
      new GetCommand({ TableName: users, Key: { id: result.userId } }),
    );
    const hash = z
      .object({
        password: z.string(),
        mustChangePassword: z.literal(true),
        authVersion: z.literal(1),
      })
      .parse(stored.Item);
    expect(await verifyPassword(result.tempPassword, hash.password)).toBe(true);
    const reset = await fetch(origin + '/api/admin/users/reset-password', {
      method: 'POST',
      headers: { cookie: cookie(), 'content-type': 'application/json' },
      body: JSON.stringify({ email: 'admin@example.test' }),
    });
    expect(reset.status, output).toBe(200);
    const resetValue = z.object({ tempPassword: z.string() }).parse(await reset.json());
    const oldSession = await fetch(origin + '/api/auth/session', { headers: { cookie: cookie() } });
    expect(await oldSession.json()).toBeNull();
    expect(
      (await fetch(origin + '/api/admin/users', { headers: { cookie: cookie() } })).status,
    ).toBe(401);
    async function signInAgain(value: string) {
      const response = await fetch(origin + '/api/auth/callback/credentials', {
        method: 'POST',
        redirect: 'manual',
        headers: { cookie: cookie(), 'content-type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          email: 'admin@example.test',
          password: value,
          csrfToken: token.csrfToken,
          callbackUrl: 'https://dashboard.example.test/repos',
        }),
      });
      expect(response.headers.get('location')).toBe('https://dashboard.example.test/repos');
      accept(response);
    }
    await signInAgain(resetValue.tempPassword);
    expect(
      (await fetch(origin + '/api/admin/users', { headers: { cookie: cookie() } })).status,
    ).toBe(403);
    const changed = await fetch(origin + '/api/auth/change-password', {
      method: 'POST',
      headers: { cookie: cookie(), 'content-type': 'application/json' },
      body: JSON.stringify({
        currentPassword: resetValue.tempPassword,
        newPassword: 'DifferentSecurePassword2!',
      }),
    });
    expect(changed.status, output).toBe(200);
    expect(
      await (await fetch(origin + '/api/auth/session', { headers: { cookie: cookie() } })).json(),
    ).toBeNull();
    await signInAgain('DifferentSecurePassword2!');
    expect(
      (await fetch(origin + '/api/admin/users', { headers: { cookie: cookie() } })).status,
    ).toBe(200);
  } finally {
    if (child) {
      child.kill('SIGTERM');
      await Promise.race([
        new Promise<void>((resolve) => child!.once('exit', () => resolve())),
        setTimeout(3000),
      ]);
      if (child.exitCode === null) child.kill('SIGKILL');
    }
    secretServer.closeAllConnections();
    await new Promise<void>((resolve, reject) =>
      secretServer.close((error) => (error ? reject(error) : resolve())),
    );
    client.destroy();
    await rm(root, { recursive: true, force: true });
  }
});
