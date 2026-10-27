import { mkdtemp, cp, symlink, writeFile, readFile, rm } from 'node:fs/promises';
import { tmpdir, devNull } from 'node:os';
import { join, resolve } from 'node:path';
import { createServer, request as forwardRequest } from 'node:http';
import { createServer as createPortServer } from 'node:net';
import { spawn } from 'node:child_process';
import { setTimeout as sleep } from 'node:timers/promises';
import { randomUUID } from 'node:crypto';
import { DynamoDBClient, CreateTableCommand } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, PutCommand } from '@aws-sdk/lib-dynamodb';
import { hashPassword } from '@/lib/auth/passwords';
import type { AccountRole } from '@/models/accounts';
import { writeRuntimeSettings } from '../../scripts/runtime-settings.mjs';

export async function startProductionApp(endpoint: string, options: { browser?: boolean } = {}) {
  if (new URL(endpoint).hostname !== '127.0.0.1')
    throw new Error('Only local account fixtures are allowed');
  if ((await readFile('.next/dashboard-mode', 'utf8')).trim() !== 'production')
    throw new Error('Build production before the production suite');
  const root = await mkdtemp(join(tmpdir(), 'dashboard-production-'));
  const client = DynamoDBDocumentClient.from(
    new DynamoDBClient({
      endpoint,
      region: 'us-east-2',
      credentials: { accessKeyId: 'local', secretAccessKey: 'local' },
      maxAttempts: 1,
    }),
    { marshallOptions: { removeUndefinedValues: true } },
  );
  const suffix = randomUUID();
  const users = 'fixture-users-' + suffix,
    whitelist = 'fixture-whitelist-' + suffix;
  const secret = 'production-fixture-only-managed-signing-key-0123456789';
  const arn = 'arn:aws:secretsmanager:us-east-2:123456789012:secret:fixture-auth';
  let secretReads = 0,
    output = '';
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
  let accountUnavailable = false;
  const accountProxy = createServer((request, response) => {
    if (accountUnavailable) {
      response.writeHead(500, { 'content-type': 'application/x-amz-json-1.0' });
      response.end(
        JSON.stringify({ __type: 'InternalServerError', message: 'controlled fixture outage' }),
      );
      return;
    }
    const forwarded = forwardRequest(
      endpoint,
      { method: request.method, headers: request.headers, agent: false },
      (upstream) => {
        response.writeHead(upstream.statusCode ?? 502, upstream.headers);
        upstream.pipe(response);
      },
    );
    forwarded.on('error', () => {
      if (!response.headersSent) response.writeHead(502);
      response.end();
    });
    request.on('aborted', () => forwarded.destroy());
    request.pipe(forwarded);
  });
  let child: ReturnType<typeof spawn> | undefined;
  async function dispose() {
    if (child && child.exitCode === null && child.signalCode === null) {
      child.kill('SIGTERM');
      await Promise.race([new Promise<void>((r) => child!.once('exit', () => r())), sleep(2000)]);
      if (child.exitCode === null && child.signalCode === null) child.kill('SIGKILL');
    }
    accountProxy.closeAllConnections();
    if (accountProxy.listening)
      await new Promise<void>((resolve, reject) =>
        accountProxy.close((error) => (error ? reject(error) : resolve())),
      );
    secretServer.closeAllConnections();
    if (secretServer.listening)
      await new Promise<void>((resolve, reject) =>
        secretServer.close((error) => (error ? reject(error) : resolve())),
      );
    client.destroy();
    await rm(root, { recursive: true, force: true });
  }
  try {
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
    await new Promise<void>((resolve, reject) => {
      secretServer.once('error', reject);
      secretServer.listen(0, '127.0.0.1', resolve);
    });
    await new Promise<void>((resolve, reject) => {
      accountProxy.once('error', reject);
      accountProxy.listen(0, '127.0.0.1', resolve);
    });
    const accountAddress = accountProxy.address();
    if (!accountAddress || typeof accountAddress === 'string')
      throw new Error('No account fixture port');
    const secretAddress = secretServer.address();
    if (!secretAddress || typeof secretAddress === 'string')
      throw new Error('No secret fixture port');
    const portServer = createPortServer();
    await new Promise<void>((resolve, reject) => {
      portServer.once('error', reject);
      portServer.listen(0, '127.0.0.1', resolve);
    });
    const address = portServer.address();
    if (!address || typeof address === 'string') throw new Error('No application port');
    await new Promise<void>((resolve, reject) =>
      portServer.close((error) => (error ? reject(error) : resolve())),
    );
    const origin = 'http://127.0.0.1:' + address.port;
    const authOrigin = options.browser ? origin : 'https://dashboard.example.test';
    await cp('.next', join(root, '.next'), {
      recursive: true,
      filter: (path) => !path.includes('/.next/cache'),
    });
    await cp('public', join(root, 'public'), { recursive: true });
    await symlink(resolve('node_modules'), join(root, 'node_modules'), 'dir');
    await writeFile(join(root, 'package.json'), '{"type":"module"}\n');
    await writeRuntimeSettings(
      {
        AWS_APP_ID: options.browser ? undefined : 'fixture',
        DYNAMODB_REGION: 'us-east-2',
        DYNAMODB_USERS_TABLE: users,
        DYNAMODB_WHITELIST_TABLE: whitelist,
        AUTH_URL: authOrigin,
        DASHBOARD_AUTH_SECRET_ARN: arn,
      },
      join(root, '.next/server/dashboard-runtime.json'),
    );
    const env: NodeJS.ProcessEnv = {
      NODE_ENV: 'production',
      ...Object.fromEntries(
        Object.entries(process.env).filter(
          ([key]) =>
            !/^(AWS_|S3_|DYNAMODB_|AUTH_|NEXTAUTH_|AMPLIFY_|NEXT_PUBLIC_|DASHBOARD_)/.test(key),
        ),
      ),
    };
    Object.assign(env, {
      NODE_ENV: 'production',
      NEXT_TELEMETRY_DISABLED: '1',
      AWS_ACCESS_KEY_ID: 'local',
      AWS_SECRET_ACCESS_KEY: 'local',
      AWS_EC2_METADATA_DISABLED: 'true',
      AWS_CONFIG_FILE: devNull,
      AWS_SHARED_CREDENTIALS_FILE: devNull,
      AWS_IGNORE_CONFIGURED_ENDPOINT_URLS: 'false',
      AWS_ENDPOINT_URL_DYNAMODB: 'http://127.0.0.1:' + accountAddress.port,
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
        String(address.port),
      ],
      { cwd: root, env, stdio: ['ignore', 'pipe', 'pipe'] },
    );
    child.stdout?.on('data', (chunk: Buffer) => {
      output += chunk.toString();
    });
    child.stderr?.on('data', (chunk: Buffer) => {
      output += chunk.toString();
    });
    let ready = false;
    for (let i = 0; i < 120; i++) {
      if (child.exitCode !== null) throw new Error('Production server failed: ' + output);
      try {
        if ((await fetch(origin + '/api/health')).ok) {
          ready = true;
          break;
        }
      } catch {}
      await sleep(100);
    }
    if (!ready) throw new Error('Production server did not start: ' + output);
    async function seedUser(input: {
      id?: string;
      email: string;
      password: string;
      role?: AccountRole;
      mustChangePassword?: boolean;
      temporaryPasswordExpiresAt?: string;
    }) {
      const id = input.id ?? randomUUID(),
        role = input.role ?? 'viewer';
      await client.send(
        new PutCommand({
          TableName: users,
          Item: {
            ...input,
            id,
            role,
            password: await hashPassword(input.password),
            createdAt: 'fixture',
            updatedAt: 'fixture',
            authVersion: 1,
            mustChangePassword: input.mustChangePassword ?? false,
          },
        }),
      );
      await client.send(
        new PutCommand({
          TableName: whitelist,
          Item: { email: input.email, userId: id, role, isActive: true },
        }),
      );
      return id;
    }
    return {
      root,
      origin,
      authOrigin,
      users,
      whitelist,
      client,
      secret,
      seedUser,
      dispose,
      secretReads: () => secretReads,
      setAccountUnavailable: (value: boolean) => {
        accountUnavailable = value;
      },
      logs: () => output,
    };
  } catch (error) {
    await dispose();
    throw error;
  }
}
