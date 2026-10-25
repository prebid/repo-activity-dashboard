import {
  GetCommand,
  ScanCommand,
  TransactGetCommand,
  TransactWriteCommand,
  type TransactWriteCommandInput,
} from '@aws-sdk/lib-dynamodb';
import { TransactionCanceledException } from '@aws-sdk/client-dynamodb';
import { randomInt, randomUUID } from 'node:crypto';
import {
  accountRecordSchema,
  createAccountSchema,
  type AccountRecord,
  type AccountRole,
} from '@/models/accounts';
import { getDocClient } from '@/lib/aws/clients';
import { accountTable } from './tables';
import { getWhitelistEntry } from './whitelist';
import { AccountError } from './account-errors';
import type { AccountSnapshot } from './session-policy';
import type { AccessUser } from './access-policy';
export type User = AccountRecord;
export type AccountAuthority = { kind: 'operator' } | ({ kind: 'session' } & AccessUser);
export interface PreparedAccount {
  user: User;
  tempPassword: string;
}
type Write = NonNullable<TransactWriteCommandInput['TransactItems']>[number];
export const bootstrapId = '__dashboard_bootstrap_v1__';

function nextVersion(version: number): number {
  if (!Number.isSafeInteger(version + 1)) throw new AccountError('integrity');
  return version + 1;
}
function revisionCondition(version: number): string {
  return version === 0
    ? '(attribute_not_exists(authVersion) OR authVersion = :version)'
    : 'authVersion = :version';
}
async function transaction(items: Write[], token: string = randomUUID()): Promise<void> {
  try {
    await getDocClient().send(
      new TransactWriteCommand({ TransactItems: items, ClientRequestToken: token }),
    );
  } catch (error) {
    if (
      error instanceof TransactionCanceledException &&
      error.CancellationReasons?.some((reason) =>
        ['ConditionalCheckFailed', 'TransactionConflict'].includes(reason.Code ?? ''),
      )
    )
      throw new AccountError('conflict');
    throw error;
  }
}
function authorityChecks(authority: AccountAuthority, target?: User): Write[] {
  if (authority.kind === 'operator') return [];
  if (authority.role !== 'admin' || authority.mustChangePassword)
    throw new AccountError('conflict');
  const checks: Write[] = [
    {
      ConditionCheck: {
        TableName: accountTable('whitelist'),
        Key: { email: authority.email },
        ConditionExpression:
          'isActive = :active AND #role = :role AND (attribute_not_exists(userId) OR userId = :id)',
        ExpressionAttributeNames: { '#role': 'role' },
        ExpressionAttributeValues: { ':active': true, ':role': 'admin', ':id': authority.id },
      },
    },
  ];
  if (target?.id === authority.id) {
    if (target.authVersion !== authority.authVersion || target.role !== 'admin')
      throw new AccountError('conflict');
  } else
    checks.push({
      ConditionCheck: {
        TableName: accountTable('users'),
        Key: { id: authority.id },
        ConditionExpression:
          'attribute_exists(id) AND email = :email AND #role = :role AND (attribute_not_exists(mustChangePassword) OR mustChangePassword = :notRequired) AND ' +
          revisionCondition(authority.authVersion),
        ExpressionAttributeNames: { '#role': 'role' },
        ExpressionAttributeValues: {
          ':email': authority.email,
          ':role': 'admin',
          ':notRequired': false,
          ':version': authority.authVersion,
        },
      },
    });
  return checks;
}

export async function getUserByEmail(rawEmail: string): Promise<User | null> {
  const email = rawEmail.trim().toLowerCase();
  const access = await getWhitelistEntry(email);
  if (access?.userId) {
    const user = await getUserById(access.userId);
    if (!user || user.email !== email) throw new AccountError('integrity');
    return user;
  }
  // Compatibility until the operator migration has linked existing UUID accounts.
  // Read every page so duplicates fail closed instead of choosing an arbitrary account.
  let found: User | null = null;
  let cursor: Record<string, unknown> | undefined;
  const seen = new Set<string>();
  do {
    const result = await getDocClient().send(
      new ScanCommand({
        TableName: accountTable('users'),
        FilterExpression: 'email = :email',
        ExpressionAttributeValues: { ':email': email },
        Limit: 100,
        ConsistentRead: true,
        ExclusiveStartKey: cursor,
      }),
    );
    for (const item of result.Items ?? []) {
      if (found) throw new AccountError('integrity');
      found = accountRecordSchema.parse(item);
    }
    cursor = result.LastEvaluatedKey;
    if (cursor && Object.keys(cursor).length) {
      const key = JSON.stringify(cursor);
      if (seen.has(key)) throw new AccountError('integrity');
      seen.add(key);
    }
  } while (cursor && Object.keys(cursor).length);
  return found;
}
export async function getUserById(id: string): Promise<User | null> {
  const result = await getDocClient().send(
    new GetCommand({ TableName: accountTable('users'), Key: { id }, ConsistentRead: true }),
  );
  return result.Item ? accountRecordSchema.parse(result.Item) : null;
}
export async function getAccountSnapshot(id: string, email: string): Promise<AccountSnapshot> {
  const result = await getDocClient().send(
    new TransactGetCommand({
      TransactItems: [
        { Get: { TableName: accountTable('users'), Key: { id } } },
        { Get: { TableName: accountTable('whitelist'), Key: { email } } },
      ],
    }),
  );
  return { user: result.Responses?.[0]?.Item, access: result.Responses?.[1]?.Item };
}
export function generateTempPassword(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789!@#$';
  let password = '';
  for (let i = 0; i < 12; i++) password += chars.charAt(randomInt(chars.length));
  return password;
}
export async function prepareAccount(input: unknown, createdBy: string): Promise<PreparedAccount> {
  const fields = createAccountSchema.parse(input);
  const tempPassword = generateTempPassword();
  const { hashPassword } = await import('./passwords');
  const now = new Date().toISOString();
  return {
    tempPassword,
    user: {
      ...fields,
      id: randomUUID(),
      name: fields.name || fields.email.split('@')[0],
      password: await hashPassword(tempPassword),
      createdAt: now,
      updatedAt: now,
      createdBy,
      mustChangePassword: true,
      authVersion: 1,
    },
  };
}
export async function createPreparedAccount(
  prepared: PreparedAccount,
  authority: AccountAuthority,
  bootstrap = false,
): Promise<void> {
  const user = accountRecordSchema.parse(prepared.user);
  if (bootstrap && (authority.kind !== 'operator' || user.role !== 'admin'))
    throw new AccountError('conflict');
  if (bootstrap && (await listAccounts()).length) throw new AccountError('bootstrap-complete');
  if (await getUserByEmail(user.email)) throw new AccountError('exists');
  const items: Write[] = [
    {
      Put: {
        TableName: accountTable('users'),
        Item: user,
        ConditionExpression: 'attribute_not_exists(id)',
      },
    },
    {
      Update: {
        TableName: accountTable('whitelist'),
        Key: { email: user.email },
        UpdateExpression:
          'SET userId = :id, #role = :role, isActive = :active, addedAt = :at, addedBy = :by',
        ConditionExpression: 'attribute_not_exists(userId)',
        ExpressionAttributeNames: { '#role': 'role' },
        ExpressionAttributeValues: {
          ':id': user.id,
          ':role': user.role,
          ':active': true,
          ':at': user.createdAt,
          ':by': user.createdBy,
        },
      },
    },
    ...authorityChecks(authority),
  ];
  if (bootstrap)
    items.push({
      Put: {
        TableName: accountTable('users'),
        Item: { id: bootstrapId, kind: 'bootstrap', userId: user.id, completedAt: user.createdAt },
        ConditionExpression: 'attribute_not_exists(id)',
      },
    });
  await transaction(items, user.id);
}
export async function adminCreateUser(
  email: string,
  name: string | undefined,
  role: AccountRole,
  company: string | undefined,
  authority: AccountAuthority,
): Promise<PreparedAccount> {
  const prepared = await prepareAccount(
    { email, name, role, company },
    authority.kind === 'session' ? authority.email : 'operator',
  );
  await createPreparedAccount(prepared, authority);
  return prepared;
}
export async function updateUserPassword(
  user: User,
  newHashedPassword: string,
  authority: AccountAuthority,
  mustChange: boolean,
): Promise<void> {
  const now = new Date().toISOString();
  const admin = mustChange || authority.kind === 'operator';
  if (
    !admin &&
    (authority.kind !== 'session' ||
      authority.id !== user.id ||
      authority.email !== user.email ||
      authority.authVersion !== user.authVersion)
  )
    throw new AccountError('conflict');
  const checks = admin
    ? authorityChecks(authority, user)
    : [
        {
          ConditionCheck: {
            TableName: accountTable('whitelist'),
            Key: { email: user.email },
            ConditionExpression:
              'isActive = :active AND (attribute_not_exists(userId) OR userId = :id)',
            ExpressionAttributeValues: { ':active': true, ':id': user.id },
          },
        },
      ];
  const selfAdmin = admin && authority.kind === 'session' && authority.id === user.id;
  await transaction([
    {
      Update: {
        TableName: accountTable('users'),
        Key: { id: user.id },
        UpdateExpression:
          'SET password = :password, mustChangePassword = :mustChange, lastPasswordChange = :now, updatedAt = :now, authVersion = :next',
        ConditionExpression:
          'attribute_exists(id) AND email = :email AND password = :oldPassword AND ' +
          revisionCondition(user.authVersion) +
          (selfAdmin
            ? ' AND #role = :admin AND (attribute_not_exists(mustChangePassword) OR mustChangePassword = :notRequired)'
            : ''),
        ...(selfAdmin ? { ExpressionAttributeNames: { '#role': 'role' } } : {}),
        ExpressionAttributeValues: {
          ':password': newHashedPassword,
          ':mustChange': mustChange,
          ':now': now,
          ':next': nextVersion(user.authVersion),
          ':version': user.authVersion,
          ':email': user.email,
          ':oldPassword': user.password,
          ...(selfAdmin ? { ':admin': 'admin', ':notRequired': false } : {}),
        },
      },
    },
    ...checks,
  ]);
}
export async function adminResetPassword(
  email: string,
  authority: AccountAuthority,
): Promise<{ tempPassword: string }> {
  const user = await getUserByEmail(email);
  if (!user) throw new AccountError('not-found');
  const tempPassword = generateTempPassword();
  const { hashPassword } = await import('./passwords');
  await updateUserPassword(user, await hashPassword(tempPassword), authority, true);
  return { tempPassword };
}
export async function listAccounts(): Promise<User[]> {
  const users: User[] = [];
  let cursor: Record<string, unknown> | undefined;
  const seen = new Set<string>();
  do {
    const result = await getDocClient().send(
      new ScanCommand({
        TableName: accountTable('users'),
        FilterExpression: 'attribute_exists(email)',
        ConsistentRead: true,
        ExclusiveStartKey: cursor,
      }),
    );
    for (const item of result.Items ?? []) {
      const user = accountRecordSchema.parse(item);
      if (item.email !== user.email) throw new AccountError('integrity');
      users.push(user);
    }
    cursor = result.LastEvaluatedKey;
    if (cursor && Object.keys(cursor).length) {
      const key = JSON.stringify(cursor);
      if (seen.has(key)) throw new AccountError('integrity');
      seen.add(key);
    }
  } while (cursor && Object.keys(cursor).length);
  return users;
}
export async function migrateAccountLinks(
  apply: boolean,
): Promise<{ accounts: number; linked: number }> {
  const users = await listAccounts();
  const emails = new Set<string>();
  for (const user of users) {
    if (emails.has(user.email)) throw new AccountError('integrity');
    emails.add(user.email);
    const access = await getWhitelistEntry(user.email);
    if (access?.userId && access.userId !== user.id) throw new AccountError('integrity');
  }
  if (apply)
    for (const user of users)
      await transaction([
        {
          ConditionCheck: {
            TableName: accountTable('users'),
            Key: { id: user.id },
            ConditionExpression: 'email = :email',
            ExpressionAttributeValues: { ':email': user.email },
          },
        },
        {
          Update: {
            TableName: accountTable('whitelist'),
            Key: { email: user.email },
            UpdateExpression:
              'SET userId = :id, #role = if_not_exists(#role, :role), isActive = if_not_exists(isActive, :inactive)',
            ConditionExpression: 'attribute_not_exists(userId) OR userId = :id',
            ExpressionAttributeNames: { '#role': 'role' },
            ExpressionAttributeValues: { ':id': user.id, ':role': user.role, ':inactive': false },
          },
        },
      ]);
  return { accounts: users.length, linked: apply ? users.length : 0 };
}
export async function setAccountAccess(
  user: User,
  role: AccountRole,
  active: boolean,
): Promise<void> {
  // Operator-only IAM command. Changing access also prevents old cookies reviving after re-enable.
  await transaction([
    {
      Update: {
        TableName: accountTable('users'),
        Key: { id: user.id },
        UpdateExpression: 'SET #role = :role, authVersion = :next, updatedAt = :now',
        ConditionExpression:
          'attribute_exists(id) AND email = :email AND ' + revisionCondition(user.authVersion),
        ExpressionAttributeNames: { '#role': 'role' },
        ExpressionAttributeValues: {
          ':role': role,
          ':next': nextVersion(user.authVersion),
          ':version': user.authVersion,
          ':now': new Date().toISOString(),
          ':email': user.email,
        },
      },
    },
    {
      Update: {
        TableName: accountTable('whitelist'),
        Key: { email: user.email },
        UpdateExpression: 'SET #role = :role, isActive = :active, userId = :id',
        ConditionExpression: 'attribute_not_exists(userId) OR userId = :id',
        ExpressionAttributeNames: { '#role': 'role' },
        ExpressionAttributeValues: { ':role': role, ':active': active, ':id': user.id },
      },
    },
  ]);
}
