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
const holder = vi.hoisted(() => ({
  client: undefined as DynamoDBDocumentClient | undefined,
  endpoint: '',
}));
vi.mock('server-only', () => ({}));
vi.mock('@/lib/aws/clients', () => ({
  createAccountClient: ({ region }: { region: string }) =>
    instrument(
      DynamoDBDocumentClient.from(
        new DynamoDBClient({
          endpoint: holder.endpoint,
          region,
          credentials: { accessKeyId: 'local', secretAccessKey: 'local' },
        }),
        { marshallOptions: { removeUndefinedValues: true } },
      ),
    ),
}));
import { createAccountStore, bootstrapId, type AccountStore } from '@/lib/auth/account-store';
let store: AccountStore;
const getWhitelistEntry = (email: string) => store.getWhitelistEntry(email);
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
  holder.endpoint = endpoint;
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
  instrument(holder.client);
});
function instrument(target: DynamoDBDocumentClient) {
  target.middlewareStack.add(
    (next, context) => async (args) => {
      const writing = context.commandName?.includes('TransactWrite') ?? false;
      if (writing) await beforeWrite?.();
      const result = await next(args);
      if (writing) afterWrite?.();
      return result;
    },
    { name: 'adversarialInterleavings', step: 'initialize' },
  );
  return target;
}
beforeEach(async () => {
  beforeWrite = undefined;
  afterWrite = undefined;
  users = 'users-' + randomUUID();
  whitelist = 'whitelist-' + randomUUID();
  store = createAccountStore(db(), {
    region: 'us-east-2',
    usersTable: users,
    whitelistTable: whitelist,
  });
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
  const marker = await db().send(new GetCommand({ TableName: users, Key: { id: bootstrapId } }));
  expect(marker.Item?.userId).toBe(records[0].id);
  expect(records[0].mustChangePassword).toBe(true);
  await expect(store.createPreparedAccount(one, operator, true)).rejects.toMatchObject({
    code: 'bootstrap-complete',
  });
});
it('does not bootstrap after ordinary provisioning commits during its preflight window', async () => {
  const prepared = await store.prepareAccount(
    { email: 'bootstrap@example.test', role: 'admin' },
    'operator',
  );
  let intercepted = false;
  beforeWrite = async () => {
    beforeWrite = undefined;
    intercepted = true;
    await seed('ordinary@example.test');
  };
  await expect(store.createPreparedAccount(prepared, operator, true)).rejects.toMatchObject({
    code: 'conflict',
  });
  expect(intercepted).toBe(true);
  expect(await store.listAccounts()).toHaveLength(1);
  expect(await store.getUserByEmail(prepared.user.email)).toBeNull();
});
it('binds a self-reset to the authenticated email as well as the account ID and version', async () => {
  const { user } = await seed('before@example.test', 'admin');
  await db().send(
    new UpdateCommand({
      TableName: users,
      Key: { id: user.id },
      UpdateExpression: 'SET email = :email',
      ExpressionAttributeValues: { ':email': 'after@example.test' },
    }),
  );
  await db().send(
    new PutCommand({
      TableName: whitelist,
      Item: { email: 'after@example.test', userId: user.id, role: 'admin', isActive: true },
    }),
  );
  await expect(
    store.adminResetPassword('after@example.test', { kind: 'session', ...user }),
  ).rejects.toMatchObject({ code: 'conflict' });
  expect((await store.getUserById(user.id))?.authVersion).toBe(user.authVersion);
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
  expect(await store.migrateAccountLinks(false)).toMatchObject({ accounts: 2, linked: 0 });
  expect((await getWhitelistEntry(legacy.email))?.userId).toBeUndefined();
  expect(await store.migrateAccountLinks(true)).toMatchObject({ accounts: 2, linked: 2 });
  expect(await store.migrateAccountLinks(true)).toMatchObject({ accounts: 2, linked: 2 });
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
  expect(await runOperator(['migrate', ...target])).toMatchObject({ accounts: 1, linked: 0 });
  expect(await runOperator(['migrate', ...target, '--apply'])).toMatchObject({
    accounts: 1,
    linked: 1,
  });
  expect((await getWhitelistEntry(user.email))?.isActive).toBe(false);
});
it('keeps independent stores bound to their own table pair without process-global targets', async () => {
  const target = { region: 'us-east-2', usersTable: users, whitelistTable: whitelist };
  const first = createAccountStore(db(), target);
  const other = {
    region: 'us-east-2',
    usersTable: 'other-users-' + randomUUID(),
    whitelistTable: 'other-whitelist-' + randomUUID(),
  };
  for (const [TableName, key] of [
    [other.usersTable, 'id'],
    [other.whitelistTable, 'email'],
  ])
    await client.send(
      new CreateTableCommand({
        TableName,
        KeySchema: [{ AttributeName: key, KeyType: 'HASH' }],
        AttributeDefinitions: [{ AttributeName: key, AttributeType: 'S' }],
        BillingMode: 'PAY_PER_REQUEST',
      }),
    );
  const second = createAccountStore(db(), other);
  target.usersTable = other.usersTable;
  target.whitelistTable = other.whitelistTable;
  const a = await first.prepareAccount({ email: 'same@example.test' }, 'first');
  const b = await second.prepareAccount({ email: 'same@example.test' }, 'second');
  await Promise.all([
    first.createPreparedAccount(a, operator),
    second.createPreparedAccount(b, operator),
  ]);
  expect((await first.getUserByEmail('same@example.test'))?.id).toBe(a.user.id);
  expect((await second.getUserByEmail('same@example.test'))?.id).toBe(b.user.id);
  expect(await first.listAccounts()).toHaveLength(1);
  expect(await second.listAccounts()).toHaveLength(1);
});
it('reads a complete whitelist across real service pages while preserving disabled state and excluding extra fields', async () => {
  const active = await seed('active@example.test');
  const disabled = await seed('disabled@example.test');
  await store.setAccountAccess(disabled.user, 'viewer', false);
  expect(await store.isEmailWhitelisted(active.user.email)).toBe(true);
  expect(await store.isEmailWhitelisted(disabled.user.email)).toBe(false);
  expect(await store.isEmailWhitelisted('missing@example.test')).toBe(false);
  await Promise.all(
    Array.from({ length: 16 }, (_, i) =>
      db().send(
        new PutCommand({
          TableName: whitelist,
          Item: {
            email: `page-${i}@example.test`,
            role: 'viewer',
            isActive: true,
            padding: 'x'.repeat(80_000),
            password: 'must-not-be-exported',
          },
        }),
      ),
    ),
  );
  let pages = 0;
  db().middlewareStack.add(
    (next, context) => (args) => {
      if (context.commandName?.includes('Scan')) pages++;
      return next(args);
    },
    { name: 'countWhitelistPages', step: 'initialize' },
  );
  try {
    const rows = await store.getAllWhitelistedEmails();
    expect(rows).toHaveLength(18);
    expect(pages).toBeGreaterThan(1);
    expect(rows.find((row) => row.email === disabled.user.email)?.isActive).toBe(false);
    expect(JSON.stringify(rows)).not.toContain('must-not-be-exported');
    expect(JSON.stringify(rows)).not.toContain('padding');
  } finally {
    db().middlewareStack.remove('countWhitelistPages');
  }
});

it('accepts documented numeric whitelist metadata and checks account-less entries before migration writes', async () => {
  const { user } = await seed('numeric@example.test');
  await db().send(
    new UpdateCommand({
      TableName: whitelist,
      Key: { email: user.email },
      UpdateExpression: 'SET addedAt = :at',
      ExpressionAttributeValues: { ':at': 1754006400000 },
    }),
  );
  expect((await store.getWhitelistEntry(user.email))?.addedAt).toBe(1754006400000);
  expect(await store.isEmailWhitelisted(user.email)).toBe(true);
  expect(await store.getUserByEmail(user.email)).toMatchObject({ id: user.id });
  await db().send(
    new PutCommand({
      TableName: whitelist,
      Item: {
        email: 'pending@example.test',
        isActive: true,
        addedAt: { invalid: 'secret-value-canary' },
      },
    }),
  );
  await expect(store.migrateAccountLinks(false)).rejects.toMatchObject({
    records: [{ table: 'whitelist', key: 'pending@example.test', fields: ['addedAt'] }],
  });
  let writes = 0;
  beforeWrite = () => {
    writes++;
    return Promise.resolve();
  };
  await expect(store.migrateAccountLinks(true)).rejects.toMatchObject({ code: 'integrity' });
  expect(writes).toBe(0);
  await db().send(
    new UpdateCommand({
      TableName: whitelist,
      Key: { email: 'pending@example.test' },
      UpdateExpression: 'SET addedAt = :at',
      ExpressionAttributeValues: { ':at': 1754006400000 },
    }),
  );
  expect(await store.migrateAccountLinks(true)).toMatchObject({ accounts: 1, linked: 1 });
  expect(await store.getAllWhitelistedEmails()).toHaveLength(2);
});
it('reports partial migration progress and safely resumes after interruption', async () => {
  for (const id of ['legacy-a', 'legacy-b'])
    await db().send(
      new PutCommand({
        TableName: users,
        Item: {
          id,
          email: id + '@example.test',
          password: 'hash',
          createdAt: 'old',
          updatedAt: 'old',
        },
      }),
    );
  let calls = 0;
  beforeWrite = () => {
    if (++calls === 2) throw new Error('transport interrupted');
    return Promise.resolve();
  };
  await expect(store.migrateAccountLinks(true)).rejects.toMatchObject({
    completed: ['legacy-a'],
    pending: ['legacy-b'],
  });
  expect((await getWhitelistEntry('legacy-a@example.test'))?.userId).toBe('legacy-a');
  expect(await getWhitelistEntry('legacy-b@example.test')).toBeNull();
  beforeWrite = undefined;
  expect(await store.migrateAccountLinks(true)).toMatchObject({ accounts: 2, linked: 2 });
  expect((await getWhitelistEntry('legacy-b@example.test'))?.isActive).toBe(false);
});

it('reports malformed user fields without serializing the stored hash or password value', async () => {
  await db().send(
    new PutCommand({
      TableName: users,
      Item: {
        id: 'bad',
        email: 'bad@example.test',
        password: { secret: 'must-not-be-reported' },
        createdAt: 'old',
        updatedAt: 'old',
      },
    }),
  );
  await expect(store.migrateAccountLinks(true)).rejects.toMatchObject({
    records: [{ table: 'users', key: 'bad', fields: ['password'] }],
  });
});
it('uses one configured expiry and refuses expired issuance or password changes', async () => {
  let clock = Date.now();
  const timed = createAccountStore(
    db(),
    { region: 'us-east-2', usersTable: users, whitelistTable: whitelist },
    { now: () => clock, temporaryPasswordHours: 48 },
  );
  const prepared = await timed.prepareAccount({ email: 'timed@example.test' }, 'operator');
  expect(Date.parse(prepared.expiresAt) - Date.parse(prepared.user.createdAt)).toBe(
    48 * 60 * 60 * 1000,
  );
  expect(prepared.user.temporaryPasswordExpiresAt).toBe(prepared.expiresAt);
  await timed.createPreparedAccount(prepared, operator);
  clock = Date.parse(prepared.expiresAt);
  await expect(
    timed.updateUserPassword(
      prepared.user,
      'newhash',
      { kind: 'session', ...prepared.user },
      false,
    ),
  ).rejects.toMatchObject({ code: 'expired' });
  expect((await timed.migrateAccountLinks(false)).requiresCredentialReissue).toEqual([
    { id: prepared.user.id, email: prepared.user.email },
  ]);
  const stale = await timed.prepareAccount({ email: 'stale@example.test' }, 'operator');
  clock = Date.parse(stale.expiresAt);
  await expect(timed.createPreparedAccount(stale, operator)).rejects.toMatchObject({
    code: 'expired',
  });
  expect(await timed.getUserByEmail(stale.user.email)).toBeNull();
  const replacement = await timed.preparePasswordReset(prepared.user);
  await timed.commitPasswordReset(replacement, operator);
  expect((await timed.getUserById(prepared.user.id))?.temporaryPasswordExpiresAt).toBe(
    replacement.expiresAt,
  );
  const updated = await timed.getUserById(prepared.user.id);
  if (!updated) throw new Error('Missing account');
  await timed.updateUserPassword(updated, 'permanenthash', { kind: 'session', ...updated }, false);
  expect(await timed.getUserById(updated.id)).toMatchObject({
    mustChangePassword: false,
    authVersion: 3,
    password: 'permanenthash',
  });
  expect((await timed.getUserById(updated.id))?.temporaryPasswordExpiresAt).toBeUndefined();
  clock = Date.parse(replacement.expiresAt);
  await expect(timed.commitPasswordReset(replacement, operator)).rejects.toMatchObject({
    code: 'expired',
  });
});
it('allows only one reset prepared against the same account revision', async () => {
  const { user } = await seed('reset-race@example.test');
  const first = await store.preparePasswordReset(user),
    second = await store.preparePasswordReset(user);
  const observed = twoWriters();
  const results = await Promise.allSettled([
    store.commitPasswordReset(first, operator),
    store.commitPasswordReset(second, operator),
  ]);
  observed();
  expect(results.filter((r) => r.status === 'fulfilled')).toHaveLength(1);
  const saved = await store.getUserById(user.id);
  if (!saved) throw new Error('Missing account');
  expect(saved.authVersion).toBe(user.authVersion + 1);
  expect(
    [
      await verifyPassword(first.tempPassword, saved.password),
      await verifyPassword(second.tempPassword, saved.password),
    ].filter(Boolean),
  ).toHaveLength(1);
});
it('rejects an expiry changed after authorization before committing a password change', async () => {
  const prepared = await store.prepareAccount({ email: 'expiry-race@example.test' }, 'operator');
  await store.createPreparedAccount(prepared, operator);
  beforeWrite = async () => {
    beforeWrite = undefined;
    await db().send(
      new UpdateCommand({
        TableName: users,
        Key: { id: prepared.user.id },
        UpdateExpression: 'SET temporaryPasswordExpiresAt = :at',
        ExpressionAttributeValues: { ':at': '2020-01-01T00:00:00.000Z' },
      }),
    );
  };
  await expect(
    store.updateUserPassword(
      prepared.user,
      'newhash',
      { kind: 'session', ...prepared.user },
      false,
    ),
  ).rejects.toMatchObject({ code: 'conflict' });
  expect((await store.getUserById(prepared.user.id))?.password).toBe(prepared.user.password);
});
it('writes the exact configured expiry to operator files before committing it', async () => {
  vi.stubEnv('DASHBOARD_TEMP_PASSWORD_HOURS', '48');
  const dir = await mkdtemp(join(tmpdir(), 'operator-expiry-'));
  directories.push(dir);
  const target = ['--region', 'us-east-2', '--users-table', users, '--whitelist-table', whitelist];
  const output = join(dir, 'created.credentials.json');
  await runOperator([
    'create',
    ...target,
    '--email',
    'file-expiry@example.test',
    '--role',
    'viewer',
    '--output',
    output,
  ]);
  const issued = z
    .object({ expiresAt: z.string(), temporaryPassword: z.string() })
    .parse(JSON.parse(await readFile(output, 'utf8')));
  const user = await store.getUserByEmail('file-expiry@example.test');
  if (!user) throw new Error('Missing account');
  expect(user.temporaryPasswordExpiresAt).toBe(issued.expiresAt);
  expect(Date.parse(issued.expiresAt) - Date.parse(user.createdAt)).toBe(48 * 60 * 60 * 1000);
  const reset = join(dir, 'reset.credentials.json');
  await runOperator(['reset-password', ...target, '--email', user.email, '--output', reset]);
  const replaced = z
    .object({ expiresAt: z.string(), temporaryPassword: z.string() })
    .parse(JSON.parse(await readFile(reset, 'utf8')));
  const current = await store.getUserById(user.id);
  expect(current?.temporaryPasswordExpiresAt).toBe(replaced.expiresAt);
  expect(await verifyPassword(issued.temporaryPassword, current!.password)).toBe(false);
  expect(await verifyPassword(replaced.temporaryPassword, current!.password)).toBe(true);
});

it('identifies malformed initialization metadata instead of failing during implicit string conversion', async () => {
  await db().send(
    new PutCommand({
      TableName: users,
      Item: { id: bootstrapId, kind: { toString: 'private-canary' } },
    }),
  );
  await expect(store.migrateAccountLinks(true)).rejects.toMatchObject({
    code: 'integrity',
    records: [{ table: 'users', key: bootstrapId }],
  });
  expect((await db().send(new ScanCommand({ TableName: whitelist }))).Items).toEqual([]);
});
