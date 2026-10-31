// @vitest-environment node
import { it, expect, inject } from 'vitest';
import { randomUUID } from 'node:crypto';
import { DynamoDBClient, CreateTableCommand } from '@aws-sdk/client-dynamodb';
import {
  DynamoDBDocumentClient,
  PutCommand,
  GetCommand,
  UpdateCommand,
} from '@aws-sdk/lib-dynamodb';
import { createLegacyAccountStore } from '@/lib/auth/legacy-account-store';
import { authorizeCredentials } from '@/lib/auth/credential-policy';
import { currentIdentity } from '@/lib/auth/session-policy';
import { hashPassword, verifyPassword } from '@/lib/auth/passwords';
async function setup() {
  const endpoint = inject('accountEndpoint');
  if (new URL(endpoint).hostname !== '127.0.0.1') throw new Error('Isolated fixture required');
  const client = DynamoDBDocumentClient.from(
    new DynamoDBClient({
      endpoint,
      region: 'us-east-2',
      credentials: { accessKeyId: 'local', secretAccessKey: 'local' },
    }),
    { marshallOptions: { removeUndefinedValues: true } },
  );
  const usersTable = 'legacy-users-' + randomUUID(),
    whitelistTable = 'legacy-access-' + randomUUID();
  for (const [TableName, key] of [
    [usersTable, 'id'],
    [whitelistTable, 'email'],
  ])
    await client.send(
      new CreateTableCommand({
        TableName,
        KeySchema: [{ AttributeName: key, KeyType: 'HASH' }],
        AttributeDefinitions: [{ AttributeName: key, AttributeType: 'S' }],
        BillingMode: 'PAY_PER_REQUEST',
      }),
    );
  const operations: string[] = [];
  client.middlewareStack.add(
    (next, context) => async (args) => {
      operations.push(context.commandName ?? '');
      if (context.commandName?.includes('Transact'))
        throw new Error('Transactions are not available');
      return next(args);
    },
    { step: 'initialize', name: 'legacyPermissions' },
  );
  const store = createLegacyAccountStore(client, {
    region: 'us-east-2',
    usersTable,
    whitelistTable,
  });
  const user = {
    id: 'admin',
    email: 'admin@example.test',
    role: 'admin' as const,
    password: await hashPassword('original-password'),
    createdAt: 'legacy',
    updatedAt: 'legacy',
  };
  await client.send(new PutCommand({ TableName: usersTable, Item: user }));
  await client.send(
    new PutCommand({
      TableName: whitelistTable,
      Item: { email: user.email, role: 'viewer', isActive: true, addedAt: 1754006400000 },
    }),
  );
  const actor = {
    kind: 'session' as const,
    id: user.id,
    email: user.email,
    role: 'admin' as const,
    authVersion: 0,
  };
  return { client, store, user, actor, usersTable, whitelistTable, operations };
}
it('preserves existing roles and records, and supports creation, reset and password replacement without migration', async () => {
  const f = await setup();
  try {
    const signedIn = await authorizeCredentials(
      { email: f.user.email, password: 'original-password' },
      { lookup: f.store.getCredentialSnapshot, verify: verifyPassword },
    );
    expect(signedIn).toMatchObject({ role: 'admin', authVersion: 0 });
    expect(await f.store.listAccountSummaries()).toEqual([
      { email: f.user.email, accountId: f.user.id, role: 'admin', status: 'active' },
    ]);
    expect(
      (
        await f.client.send(
          new GetCommand({ TableName: f.whitelistTable, Key: { email: f.user.email } }),
        )
      ).Item,
    ).not.toHaveProperty('userId');
    const issued = await f.store.adminCreateUser(
      'person@example.test',
      undefined,
      'viewer',
      undefined,
      f.actor,
    );
    expect(issued.expiresAt).toBeNull();
    expect(await verifyPassword(issued.tempPassword, issued.user.password)).toBe(true);
    const temporary = await authorizeCredentials(
      { email: issued.user.email, password: issued.tempPassword },
      { lookup: f.store.getCredentialSnapshot, verify: verifyPassword },
    );
    expect(temporary).toMatchObject({ mustChangePassword: true });
    const reset = await f.store.adminResetPassword(issued.user.email, f.actor);
    const updated = await f.store.getUserById(issued.user.id);
    expect(updated).not.toBeNull();
    if (!updated || !temporary) throw new Error('Expected the created account');
    expect(await verifyPassword(reset.tempPassword, updated.password)).toBe(true);
    await f.store.changeOwnPassword(updated, await hashPassword('permanent'), temporary);
    const final = await f.store.getUserById(issued.user.id);
    expect(final).toMatchObject({ mustChangePassword: false });
    expect(
      await authorizeCredentials(
        { email: issued.user.email, password: 'permanent' },
        { lookup: f.store.getCredentialSnapshot, verify: verifyPassword },
      ),
    ).toMatchObject({ mustChangePassword: false });
    expect(f.operations).not.toContain('TransactWriteCommand');
    expect(f.operations).not.toContain('TransactGetCommand');
  } finally {
    f.client.destroy();
  }
});
it('denies duplicate identities, inactive actors, conflicting links and missing accounts', async () => {
  const f = await setup();
  try {
    await expect(
      f.store.adminCreateUser(f.user.email, 'Duplicate', 'viewer', undefined, f.actor),
    ).rejects.toMatchObject({ code: 'exists' });
    await expect(f.store.adminResetPassword('missing@example.test', f.actor)).rejects.toMatchObject(
      { code: 'not-found' },
    );
    await f.client.send(
      new UpdateCommand({
        TableName: f.whitelistTable,
        Key: { email: f.user.email },
        UpdateExpression: 'SET userId = :id',
        ExpressionAttributeValues: { ':id': 'someone-else' },
      }),
    );
    expect(
      currentIdentity(f.actor, await f.store.getAccountSnapshot(f.user.id, f.user.email)),
    ).toBeNull();
    await expect(f.store.adminResetPassword(f.user.email, f.actor)).rejects.toMatchObject({
      code: 'conflict',
    });
    await f.client.send(
      new PutCommand({
        TableName: f.whitelistTable,
        Item: { email: f.user.email, role: 'admin', isActive: false },
      }),
    );
    expect(
      await authorizeCredentials(
        { email: f.user.email, password: 'original-password' },
        { lookup: f.store.getCredentialSnapshot, verify: verifyPassword },
      ),
    ).toBeNull();
    await expect(
      f.store.adminCreateUser('new@example.test', undefined, 'viewer', undefined, f.actor),
    ).rejects.toMatchObject({ code: 'conflict' });
    await f.client.send(
      new PutCommand({ TableName: f.usersTable, Item: { ...f.user, id: 'duplicate' } }),
    );
    await expect(f.store.getUserByEmail(f.user.email)).rejects.toMatchObject({ code: 'integrity' });
  } finally {
    f.client.destroy();
  }
});
it('rejects corrupt records rather than treating them as absent accounts', async () => {
  const f = await setup();
  try {
    await f.client.send(
      new PutCommand({ TableName: f.usersTable, Item: { ...f.user, role: 'invalid-role' } }),
    );
    await expect(f.store.getUserById(f.user.id)).rejects.toMatchObject({ code: 'integrity' });
    await f.client.send(
      new PutCommand({
        TableName: f.whitelistTable,
        Item: { email: f.user.email, isActive: 'invalid' },
      }),
    );
    await expect(f.store.getWhitelistEntry(f.user.email)).rejects.toMatchObject({
      code: 'integrity',
    });
    expect(await f.store.getUserByEmail('absent@example.test')).toBeNull();
    expect(await f.store.getWhitelistEntry('absent@example.test')).toBeNull();
  } finally {
    f.client.destroy();
  }
});
