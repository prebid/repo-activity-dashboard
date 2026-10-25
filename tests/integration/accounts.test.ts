// @vitest-environment node
import { beforeAll, beforeEach, afterAll, afterEach, it, expect, vi, inject } from 'vitest';
import { DynamoDBClient, CreateTableCommand } from '@aws-sdk/client-dynamodb';
import {
  DynamoDBDocumentClient,
  PutCommand,
  GetCommand,
  ScanCommand,
  UpdateCommand,
} from '@aws-sdk/lib-dynamodb';
import { randomUUID } from 'node:crypto';
import { mkdtemp, readFile, stat, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { z } from 'zod';
const holder = vi.hoisted(() => ({ client: undefined as DynamoDBDocumentClient | undefined }));
vi.mock('server-only', () => ({}));
vi.mock('@/lib/aws/clients', () => ({
  getDocClient: () => {
    if (!holder.client) throw new Error('Local account test client is not initialized');
    return holder.client;
  },
}));
import * as store from '@/lib/auth/users';
import { getWhitelistEntry } from '@/lib/auth/whitelist';
import { currentIdentity } from '@/lib/auth/session-policy';
import { verifyPassword } from '@/lib/auth/passwords';
import { runOperator } from '../../scripts/auth-operator';
let client: DynamoDBClient;
let users: string;
let whitelist: string;
let beforeWrite: (() => Promise<void>) | undefined;
let afterWrite: (() => void) | undefined;
const directories: string[] = [];
beforeAll(() => {
  const endpoint = inject('accountEndpoint');
  if (new URL(endpoint).hostname !== '127.0.0.1')
    throw new Error('Account tests require the isolated loopback emulator');
  client = new DynamoDBClient({
    endpoint,
    region: 'us-east-2',
    credentials: { accessKeyId: 'local', secretAccessKey: 'local' },
  });
  holder.client = DynamoDBDocumentClient.from(client, {
    marshallOptions: { removeUndefinedValues: true },
  });
  holder.client.middlewareStack.add(
    (next, context) => async (args) => {
      const writing = context.commandName?.includes('TransactWrite') ?? false;
      if (writing) await beforeWrite?.();
      const result = await next(args);
      if (writing) afterWrite?.();
      return result;
    },
    { name: 'adversarialInterleavings', step: 'initialize' },
  );
});
beforeEach(async () => {
  beforeWrite = undefined;
  afterWrite = undefined;
  users = 'users-' + randomUUID();
  whitelist = 'whitelist-' + randomUUID();
  vi.stubEnv('DYNAMODB_REGION', 'us-east-2');
  vi.stubEnv('DYNAMODB_USERS_TABLE', users);
  vi.stubEnv('DYNAMODB_WHITELIST_TABLE', whitelist);
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
});
afterEach(async () => {
  beforeWrite = undefined;
  afterWrite = undefined;
  vi.unstubAllEnvs();
  for (const path of directories.splice(0)) await rm(path, { recursive: true, force: true });
});
afterAll(() => client.destroy());
const operator = { kind: 'operator' } as const;
function db() {
  if (!holder.client) throw new Error('No local client');
  return holder.client;
}
async function seed(email: string, role: 'viewer' | 'admin' = 'viewer') {
  const prepared = await store.prepareAccount({ email, role }, 'test-operator');
  prepared.user.mustChangePassword = false;
  await store.createPreparedAccount(prepared, operator);
  return prepared;
}
function twoWriters() {
  let arrivals = 0;
  let release: () => void = () => {};
  const barrier = new Promise<void>((resolve) => {
    release = resolve;
  });
  beforeWrite = async () => {
    arrivals++;
    if (arrivals === 2) {
      beforeWrite = undefined;
      release();
    }
    await barrier;
  };
  return () => expect(arrivals).toBe(2);
}
it('atomically creates exactly one account for simultaneous normalized-email requests', async () => {
  const one = await store.prepareAccount({ email: ' Same@example.test ' }, 'operator');
  const two = await store.prepareAccount({ email: 'same@example.test' }, 'operator');
  const observed = twoWriters();
  const results = await Promise.allSettled([
    store.createPreparedAccount(one, operator),
    store.createPreparedAccount(two, operator),
  ]);
  observed();
  expect(results.filter((r) => r.status === 'fulfilled')).toHaveLength(1);
  const records = await store.listAccounts();
  expect(records).toHaveLength(1);
  expect((await getWhitelistEntry('same@example.test'))?.userId).toBe(records[0].id);
});
it('rolls back the user write if the email claim changes after preflight', async () => {
  const prepared = await store.prepareAccount({ email: 'race@example.test' }, 'operator');
  let intercepted = false;
  beforeWrite = async () => {
    beforeWrite = undefined;
    intercepted = true;
    await db().send(
      new PutCommand({
        TableName: whitelist,
        Item: {
          email: prepared.user.email,
          userId: 'someone-else',
          isActive: true,
          role: 'viewer',
        },
      }),
    );
  };
  await expect(store.createPreparedAccount(prepared, operator)).rejects.toMatchObject({
    code: 'conflict',
  });
  expect(intercepted).toBe(true);
  expect(await store.listAccounts()).toEqual([]);
  expect((await getWhitelistEntry(prepared.user.email))?.userId).toBe('someone-else');
});
it('allows only one first administrator even when concurrent operators choose different emails', async () => {
  const one = await store.prepareAccount(
    { email: 'first@example.test', role: 'admin' },
    'operator',
  );
  const two = await store.prepareAccount(
    { email: 'second@example.test', role: 'admin' },
    'operator',
  );
  const observed = twoWriters();
  const results = await Promise.allSettled([
    store.createPreparedAccount(one, operator, true),
    store.createPreparedAccount(two, operator, true),
  ]);
  observed();
  expect(results.filter((r) => r.status === 'fulfilled')).toHaveLength(1);
  const records = await store.listAccounts();
  expect(records).toHaveLength(1);
  const marker = await db().send(
    new GetCommand({ TableName: users, Key: { id: store.bootstrapId } }),
  );
  expect(marker.Item?.userId).toBe(records[0].id);
  expect(records[0].mustChangePassword).toBe(true);
  await expect(store.createPreparedAccount(one, operator, true)).rejects.toMatchObject({
    code: 'bootstrap-complete',
  });
});
it('migrates legacy UUID accounts repeatably without activating disabled or unlisted accounts', async () => {
  const legacy = {
    id: 'legacy',
    email: 'legacy@example.test',
    password: 'legacy-hash',
    role: 'admin',
    createdAt: 'old',
    updatedAt: 'old',
  };
  await db().send(new PutCommand({ TableName: users, Item: legacy }));
  await db().send(
    new PutCommand({
      TableName: whitelist,
      Item: { email: legacy.email, role: 'viewer', isActive: false },
    }),
  );
  await db().send(
    new PutCommand({
      TableName: users,
      Item: { ...legacy, id: 'unlisted', email: 'unlisted@example.test' },
    }),
  );
  expect(await store.migrateAccountLinks(false)).toEqual({ accounts: 2, linked: 0 });
  expect((await getWhitelistEntry(legacy.email))?.userId).toBeUndefined();
  expect(await store.migrateAccountLinks(true)).toEqual({ accounts: 2, linked: 2 });
  expect(await store.migrateAccountLinks(true)).toEqual({ accounts: 2, linked: 2 });
  expect(await getWhitelistEntry(legacy.email)).toMatchObject({
    userId: 'legacy',
    role: 'viewer',
    isActive: false,
  });
  expect(await getWhitelistEntry('unlisted@example.test')).toMatchObject({
    userId: 'unlisted',
    isActive: false,
  });
  expect(await store.getUserByEmail(legacy.email)).toMatchObject({
    id: 'legacy',
    authVersion: 0,
    password: 'legacy-hash',
  });
});
it('refuses ambiguous legacy duplicates before migration changes any mapping', async () => {
  for (const id of ['a', 'b'])
    await db().send(
      new PutCommand({
        TableName: users,
        Item: {
          id,
          email: 'duplicate@example.test',
          password: 'hash',
          createdAt: '',
          updatedAt: '',
        },
      }),
    );
  await expect(store.getUserByEmail('duplicate@example.test')).rejects.toMatchObject({
    code: 'integrity',
  });
  await expect(store.migrateAccountLinks(true)).rejects.toMatchObject({ code: 'integrity' });
  expect((await db().send(new ScanCommand({ TableName: whitelist }))).Items).toEqual([]);
});
it('invalidates prior claims on reset and prevents an older password change from undoing it', async () => {
  const { user, tempPassword } = await seed('password@example.test');
  const reset = await store.adminResetPassword(user.email, operator);
  const snapshot = await store.getAccountSnapshot(user.id, user.email);
  expect(currentIdentity(user, snapshot)).toBeNull();
  const changed = await store.getUserById(user.id);
  expect(changed?.authVersion).toBe(2);
  expect(changed?.mustChangePassword).toBe(true);
  expect(await verifyPassword(reset.tempPassword, changed!.password)).toBe(true);
  expect(await verifyPassword(tempPassword, changed!.password)).toBe(false);
  await expect(
    store.updateUserPassword(user, 'stale-hash', { kind: 'session', ...user }, false),
  ).rejects.toMatchObject({ code: 'conflict' });
  expect((await store.getUserById(user.id))?.password).toBe(changed?.password);
});
it('rejects an admin write revoked while the request is in flight', async () => {
  const { user: admin } = await seed('admin@example.test', 'admin');
  let intercepted = false;
  beforeWrite = async () => {
    beforeWrite = undefined;
    intercepted = true;
    await store.setAccountAccess(admin, 'viewer', true);
  };
  await expect(
    store.adminCreateUser('new@example.test', undefined, 'viewer', undefined, {
      kind: 'session',
      ...admin,
    }),
  ).rejects.toMatchObject({ code: 'conflict' });
  expect(intercepted).toBe(true);
  expect(await store.getUserByEmail('new@example.test')).toBeNull();
  expect(await getWhitelistEntry('new@example.test')).toBeNull();
});
it.each(['active', 'role', 'identity', 'version'] as const)(
  'checks the current admin %s independently at the write boundary',
  async (change) => {
    const { user: admin } = await seed('fenced@example.test', 'admin');
    let intercepted = false;
    beforeWrite = async () => {
      beforeWrite = undefined;
      intercepted = true;
      const field =
        change === 'active'
          ? 'isActive'
          : change === 'role'
            ? 'role'
            : change === 'identity'
              ? 'userId'
              : 'authVersion';
      const value =
        change === 'active'
          ? false
          : change === 'role'
            ? 'viewer'
            : change === 'identity'
              ? 'other'
              : 2;
      await db().send(
        new UpdateCommand({
          TableName: change === 'version' ? users : whitelist,
          Key: change === 'version' ? { id: admin.id } : { email: admin.email },
          UpdateExpression: 'SET #field = :value',
          ExpressionAttributeNames: { '#field': field },
          ExpressionAttributeValues: { ':value': value },
        }),
      );
    };
    await expect(
      store.adminCreateUser('blocked@example.test', undefined, 'viewer', undefined, {
        kind: 'session',
        ...admin,
      }),
    ).rejects.toMatchObject({ code: 'conflict' });
    expect(intercepted).toBe(true);
    expect(await store.getUserByEmail('blocked@example.test')).toBeNull();
    expect(await store.listAccounts()).toHaveLength(1);
  },
);
it('supports an administrator resetting their own account without duplicate transaction targets', async () => {
  const { user } = await seed('admin@example.test', 'admin');
  await store.adminResetPassword(user.email, { kind: 'session', ...user });
  expect(await store.getUserById(user.id)).toMatchObject({
    authVersion: 2,
    mustChangePassword: true,
  });
});
it('does not resurrect old sessions when an account is disabled and re-enabled', async () => {
  const { user } = await seed('access@example.test', 'admin');
  await store.setAccountAccess(user, 'viewer', false);
  expect(currentIdentity(user, await store.getAccountSnapshot(user.id, user.email))).toBeNull();
  const disabled = (await store.getUserById(user.id))!;
  await store.setAccountAccess(disabled, 'viewer', true);
  const snapshot = await store.getAccountSnapshot(user.id, user.email);
  expect(currentIdentity(user, snapshot)).toBeNull();
  expect(currentIdentity(disabled, snapshot)).toBeNull();
  expect(currentIdentity({ ...user, authVersion: 3 }, snapshot)).toMatchObject({ role: 'viewer' });
});
it('retains the operator credential privately even if a committed transaction loses its response', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'operator-credentials-'));
  directories.push(directory);
  const output = join(directory, 'first.credentials.json');
  afterWrite = () => {
    afterWrite = undefined;
    throw new Error('Simulated lost response after commit');
  };
  const args = [
    'bootstrap',
    '--email',
    'owner@example.test',
    '--region',
    'us-east-2',
    '--users-table',
    users,
    '--whitelist-table',
    whitelist,
    '--output',
    output,
  ];
  await expect(runOperator(args)).rejects.toThrow('lost response');
  const saved = z
    .object({ temporaryPassword: z.string(), accountId: z.string() })
    .parse(JSON.parse(await readFile(output, 'utf8')));
  expect((await stat(output)).mode & 0o777).toBe(0o600);
  const user = await store.getUserByEmail('owner@example.test');
  expect(user?.id).toBe(saved.accountId);
  expect(await verifyPassword(saved.temporaryPassword, user!.password)).toBe(true);
  const inspected = await runOperator([
    'inspect',
    '--email',
    'owner@example.test',
    '--region',
    'us-east-2',
    '--users-table',
    users,
    '--whitelist-table',
    whitelist,
  ]);
  expect(inspected).toMatchObject({ accountId: saved.accountId, active: true });
  expect(inspected).not.toHaveProperty('password');
  expect(inspected).not.toHaveProperty('temporaryPassword');
  await expect(runOperator(args)).rejects.toMatchObject({ code: 'EEXIST' });
  expect(await store.listAccounts()).toHaveLength(1);
});
it('executes operator creation, access changes, reset, inspection and repeat-safe migration end to end', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'operator-lifecycle-'));
  directories.push(directory);
  const target = ['--region', 'us-east-2', '--users-table', users, '--whitelist-table', whitelist];
  const created = await runOperator([
    'create',
    ...target,
    '--email',
    'managed@example.test',
    '--role',
    'user',
    '--output',
    join(directory, 'create.credentials.json'),
  ]);
  expect(created).not.toHaveProperty('tempPassword');
  await runOperator([
    'set-access',
    ...target,
    '--email',
    'managed@example.test',
    '--role',
    'viewer',
    '--active',
    'false',
  ]);
  expect(
    await runOperator(['inspect', ...target, '--email', 'managed@example.test']),
  ).toMatchObject({ role: 'viewer', active: false, authVersion: 2 });
  const output = join(directory, 'reset.credentials.json');
  await runOperator([
    'reset-password',
    ...target,
    '--email',
    'managed@example.test',
    '--output',
    output,
  ]);
  const saved = z
    .object({ temporaryPassword: z.string() })
    .parse(JSON.parse(await readFile(output, 'utf8')));
  const user = (await store.getUserByEmail('managed@example.test'))!;
  expect(user.authVersion).toBe(3);
  expect(await verifyPassword(saved.temporaryPassword, user.password)).toBe(true);
  expect(await runOperator(['migrate', ...target])).toEqual({ accounts: 1, linked: 0 });
  expect(await runOperator(['migrate', ...target, '--apply'])).toEqual({ accounts: 1, linked: 1 });
  expect((await getWhitelistEntry(user.email))?.isActive).toBe(false);
});
