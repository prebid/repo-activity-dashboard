import { randomInt, randomUUID } from 'node:crypto';
import {
  GetCommand,
  ScanCommand,
  PutCommand,
  UpdateCommand,
  type DynamoDBDocumentClient,
  type ScanCommandInput,
} from '@aws-sdk/lib-dynamodb';
import { accountTargetSchema, type AccountTarget } from '@/models/account-target';
import {
  accountRecordSchema,
  whitelistRecordSchema,
  createAccountSchema,
  summarizeAccount,
  type AccountRecord,
  type AccountRole,
  type WhitelistRecord,
} from '@/models/accounts';
import type { AccessUser } from './access-policy';
import type { AccountAuthority } from './account-store';
import type { AccountSnapshot } from './session-policy';
import { AccountError, AccountDataError } from './account-errors';
import { hashPassword } from './passwords';

// Existing table format and item operations. No migration, transactions or new AWS resources.
export function createLegacyAccountStore(client: DynamoDBDocumentClient, input: AccountTarget) {
  const target = accountTargetSchema.parse(input);
  function userRecord(value: unknown, key: string): AccountRecord | null {
    if (value == null) return null;
    const parsed = accountRecordSchema.safeParse(value);
    if (!parsed.success)
      throw new AccountDataError([
        { table: 'users', key, fields: parsed.error.issues.map((i) => i.path.join('.')) },
      ]);
    return parsed.data;
  }
  function accessRecord(value: unknown, key: string): WhitelistRecord | null {
    if (value == null) return null;
    const parsed = whitelistRecordSchema.safeParse(value);
    if (!parsed.success)
      throw new AccountDataError([
        { table: 'whitelist', key, fields: parsed.error.issues.map((i) => i.path.join('.')) },
      ]);
    return parsed.data;
  }
  async function scan(input: ScanCommandInput, signal?: AbortSignal) {
    const items: Record<string, unknown>[] = [];
    let key: ScanCommandInput['ExclusiveStartKey'];
    do {
      const result = await client.send(
        new ScanCommand({ ...input, ExclusiveStartKey: key, ConsistentRead: true }),
        { abortSignal: signal },
      );
      items.push(...(result.Items ?? []));
      key = result.LastEvaluatedKey;
    } while (key && Object.keys(key).length);
    return items;
  }
  async function getUserById(id: string, signal?: AbortSignal) {
    const result = await client.send(
      new GetCommand({ TableName: target.usersTable, Key: { id }, ConsistentRead: true }),
      { abortSignal: signal },
    );
    return userRecord(result.Item, id);
  }
  async function getUserByEmail(email: string, signal?: AbortSignal) {
    const items = await scan(
      {
        TableName: target.usersTable,
        FilterExpression: 'email = :email',
        ExpressionAttributeValues: { ':email': email },
      },
      signal,
    );
    if (items.length > 1) throw new AccountError('integrity');
    return userRecord(items[0], email);
  }
  async function getWhitelistEntry(email: string, signal?: AbortSignal) {
    const result = await client.send(
      new GetCommand({ TableName: target.whitelistTable, Key: { email }, ConsistentRead: true }),
      { abortSignal: signal },
    );
    return accessRecord(result.Item, email);
  }
  function existingAccess(user: AccountRecord | null, access: WhitelistRecord | null) {
    // The existing backend takes the role from the account and uses the whitelist for activation.
    // Missing links are resolved only in memory; explicit conflicting links remain invalid.
    return user && access
      ? { ...access, role: user.role, userId: access.userId ?? user.id }
      : access;
  }
  async function getCredentialSnapshot(email: string, signal?: AbortSignal) {
    const [user, access] = await Promise.all([
      getUserByEmail(email, signal),
      getWhitelistEntry(email, signal),
    ]);
    return { user, access: existingAccess(user, access), legacy: true as const };
  }
  async function getAccountSnapshot(
    id: string,
    email: string,
    signal?: AbortSignal,
  ): Promise<AccountSnapshot> {
    const [user, access] = await Promise.all([
      getUserById(id, signal),
      getWhitelistEntry(email, signal),
    ]);
    return { user, access: existingAccess(user, access), legacy: true };
  }
  async function assertActor(actor: AccountAuthority, admin: boolean) {
    if (actor.kind !== 'session') throw new AccountError('conflict');
    const [user, access] = await Promise.all([
      getUserById(actor.id),
      getWhitelistEntry(actor.email),
    ]);
    if (
      !user ||
      user.email !== actor.email ||
      !access?.isActive ||
      (access.userId && access.userId !== user.id) ||
      (admin && (user.role !== 'admin' || user.mustChangePassword))
    )
      throw new AccountError('conflict');
    return user;
  }
  function temporaryPassword() {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789!@#$';
    return Array.from({ length: 12 }, () => chars.charAt(randomInt(chars.length))).join('');
  }
  async function getAllWhitelistedEmails() {
    return (await scan({ TableName: target.whitelistTable })).map((entry) => {
      const access = accessRecord(entry, String(entry.email));
      if (!access) throw new AccountError('integrity');
      return access;
    });
  }
  async function listAccountSummaries() {
    const entries = await scan({ TableName: target.whitelistTable });
    return Promise.all(
      entries.map(async (entry) => {
        const access = accessRecord(entry, String(entry.email));
        if (!access) throw new AccountError('integrity');
        const user = await getUserByEmail(access.email);
        return summarizeAccount(access.email, user, existingAccess(user, access));
      }),
    );
  }
  async function adminCreateUser(
    email: string,
    name: string | undefined,
    role: AccountRole,
    company: string | undefined,
    authority: AccountAuthority,
  ) {
    const fields = createAccountSchema.parse({ email, name, role, company });
    const actor = await assertActor(authority, true);
    if (await getUserByEmail(fields.email)) throw new AccountError('exists');
    const access = await getWhitelistEntry(fields.email);
    if (access?.userId) throw new AccountError('conflict');
    const tempPassword = temporaryPassword();
    const now = new Date().toISOString();
    const record = {
      ...fields,
      id: randomUUID(),
      name: fields.name || fields.email.split('@')[0],
      password: await hashPassword(tempPassword),
      createdAt: now,
      updatedAt: now,
      createdBy: actor.email,
      mustChangePassword: true,
    };
    await client.send(
      new PutCommand({
        TableName: target.usersTable,
        Item: record,
        ConditionExpression: 'attribute_not_exists(id)',
      }),
    );
    await client.send(
      new PutCommand({
        TableName: target.whitelistTable,
        Item: {
          email: fields.email,
          role: fields.role,
          isActive: true,
          addedAt: now,
          addedBy: actor.email,
        },
      }),
    );
    return { user: accountRecordSchema.parse(record), tempPassword, expiresAt: null };
  }
  async function adminResetPassword(email: string, authority: AccountAuthority) {
    await assertActor(authority, true);
    const { user, access } = await getCredentialSnapshot(email);
    if (!user) throw new AccountError('not-found');
    if (!access?.isActive || access.userId !== user.id) throw new AccountError('conflict');
    const tempPassword = temporaryPassword();
    await client.send(
      new UpdateCommand({
        TableName: target.usersTable,
        Key: { id: user.id },
        UpdateExpression:
          'SET password = :password, mustChangePassword = :required, updatedAt = :now REMOVE temporaryPasswordExpiresAt',
        ExpressionAttributeValues: {
          ':password': await hashPassword(tempPassword),
          ':required': true,
          ':now': new Date().toISOString(),
        },
        ConditionExpression: 'attribute_exists(id)',
      }),
    );
    return { email: user.email, tempPassword, expiresAt: null };
  }
  async function changeOwnPassword(user: AccountRecord, password: string, actor: AccessUser) {
    const current = await assertActor({ kind: 'session', ...actor }, false);
    if (current.id !== user.id || current.password !== user.password)
      throw new AccountError('conflict');
    await client.send(
      new UpdateCommand({
        TableName: target.usersTable,
        Key: { id: user.id },
        UpdateExpression:
          'SET password = :password, mustChangePassword = :required, updatedAt = :now, lastPasswordChange = :now REMOVE temporaryPasswordExpiresAt',
        ExpressionAttributeValues: {
          ':password': password,
          ':required': false,
          ':now': new Date().toISOString(),
        },
        ConditionExpression: 'attribute_exists(id)',
      }),
    );
  }
  return {
    getUserByEmail,
    getWhitelistEntry,
    getAllWhitelistedEmails,
    getCredentialSnapshot,
    getAccountSnapshot,
    getUserById,
    listAccountSummaries,
    adminCreateUser,
    adminResetPassword,
    changeOwnPassword,
  };
}
