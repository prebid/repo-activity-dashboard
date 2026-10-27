import {
  temporaryPasswordHoursSchema,
  temporaryCredentialCurrent,
} from '@/models/temporary-credentials';
import {
  GetCommand,
  ScanCommand,
  TransactGetCommand,
  TransactWriteCommand,
  type TransactWriteCommandInput,
  type ScanCommandInput,
  type DynamoDBDocumentClient,
} from '@aws-sdk/lib-dynamodb';
import { TransactionCanceledException } from '@aws-sdk/client-dynamodb';
import { randomInt, randomUUID } from 'node:crypto';
import {
  accountRecordSchema,
  createAccountSchema,
  whitelistRecordSchema,
  summarizeAccount,
  type AccountSummary,
  type WhitelistRecord,
  type AccountRecord,
  type AccountRole,
} from '@/models/accounts';
import { accountTargetSchema, type AccountTarget } from '@/models/account-target';
import {
  AccountError,
  AccountDataError,
  MigrationInterruptedError,
  type RecordProblem,
} from './account-errors';
import type { AccountSnapshot } from './session-policy';
import type { AccessUser } from './access-policy';
export type User = AccountRecord;
export type AccountAuthority = { kind: 'operator' } | ({ kind: 'session' } & AccessUser);
export interface PreparedAccount {
  user: User;
  tempPassword: string;
  expiresAt: string;
}
export interface PreparedPasswordReset {
  user: User;
  tempPassword: string;
  passwordHash: string;
  expiresAt: string;
  issuedAt: string;
}
type Write = NonNullable<TransactWriteCommandInput['TransactItems']>[number];
export const bootstrapId = '__dashboard_bootstrap_v1__';

export function generateTempPassword(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789!@#$';
  let password = '';
  for (let i = 0; i < 12; i++) password += chars.charAt(randomInt(chars.length));
  return password;
}
export function createAccountStore(
  client: DynamoDBDocumentClient,
  input: AccountTarget,
  options: { now?: () => number; temporaryPasswordHours?: number } = {},
) {
  const now = options.now ?? Date.now;
  const lifetime =
    temporaryPasswordHoursSchema.parse(options.temporaryPasswordHours) * 60 * 60 * 1000;
  const target = Object.freeze(accountTargetSchema.parse(input));
  const accountTable = (kind: 'users' | 'whitelist') =>
    kind === 'users' ? target.usersTable : target.whitelistTable;
  async function issueTemporaryCredential() {
    const tempPassword = generateTempPassword();
    const { hashPassword } = await import('./passwords');
    const passwordHash = await hashPassword(tempPassword);
    const issued = now();
    return {
      tempPassword,
      passwordHash,
      issuedAt: new Date(issued).toISOString(),
      expiresAt: new Date(issued + lifetime).toISOString(),
    };
  }
  async function prepareAccount(input: unknown, createdBy: string): Promise<PreparedAccount> {
    const fields = createAccountSchema.parse(input);
    const credential = await issueTemporaryCredential();
    return {
      tempPassword: credential.tempPassword,
      expiresAt: credential.expiresAt,
      user: {
        ...fields,
        id: randomUUID(),
        name: fields.name || fields.email.split('@')[0],
        password: credential.passwordHash,
        createdAt: credential.issuedAt,
        updatedAt: credential.issuedAt,
        createdBy,
        mustChangePassword: true,
        temporaryPasswordExpiresAt: credential.expiresAt,
        authVersion: 1,
      },
    };
  }
  async function preparePasswordReset(user: User): Promise<PreparedPasswordReset> {
    return { user, ...(await issueTemporaryCredential()) };
  }
  async function commitPasswordReset(prepared: PreparedPasswordReset, authority: AccountAuthority) {
    if (Date.parse(prepared.expiresAt) <= now()) throw new AccountError('expired');
    await updateUserPassword(
      prepared.user,
      prepared.passwordHash,
      authority,
      true,
      prepared.expiresAt,
    );
  }
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
      await client.send(
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
      if (
        target.authVersion !== authority.authVersion ||
        target.role !== 'admin' ||
        target.email !== authority.email
      )
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

  function parseStored(kind: 'users', key: string, item: unknown): User;
  function parseStored(kind: 'whitelist', key: string, item: unknown): WhitelistRecord;
  function parseStored(
    kind: 'users' | 'whitelist',
    key: string,
    item: unknown,
  ): User | WhitelistRecord {
    const result = (kind === 'users' ? accountRecordSchema : whitelistRecordSchema).safeParse(item);
    if (!result.success)
      throw new AccountDataError([
        { table: kind, key, fields: result.error.issues.map((i) => i.path.join('.')) },
      ]);
    if ((item as { email: unknown }).email !== result.data.email)
      throw new AccountDataError([{ table: kind, key, fields: ['email'] }]);
    return result.data;
  }
  async function* scanPages(
    kind: 'users' | 'whitelist',
    options: Pick<
      ScanCommandInput,
      'FilterExpression' | 'ExpressionAttributeValues' | 'Limit'
    > = {},
  ) {
    let cursor: Record<string, unknown> | undefined;
    const seen = new Set<string>();
    do {
      const result = await client.send(
        new ScanCommand({
          ...options,
          TableName: accountTable(kind),
          ConsistentRead: true,
          ExclusiveStartKey: cursor,
        }),
      );
      yield result.Items ?? [];
      cursor = result.LastEvaluatedKey;
      if (cursor && Object.keys(cursor).length) {
        const key = JSON.stringify(cursor);
        if (seen.has(key)) throw new AccountError('integrity');
        seen.add(key);
      }
    } while (cursor && Object.keys(cursor).length);
  }
  async function getCredentialSnapshot(rawEmail: string, signal?: AbortSignal) {
    const email = rawEmail.trim().toLowerCase();
    const accessResult = await client.send(
      new GetCommand({
        TableName: accountTable('whitelist'),
        Key: { email },
        ConsistentRead: true,
      }),
      { abortSignal: signal },
    );
    const access = accessResult.Item ? parseStored('whitelist', email, accessResult.Item) : null;
    // Missing/unlinked identities still perform one bounded user read. Ignore the non-credential marker.
    const userResult = await client.send(
      new GetCommand({
        TableName: accountTable('users'),
        Key: { id: access?.userId ?? bootstrapId },
        ConsistentRead: true,
      }),
      { abortSignal: signal },
    );
    const user =
      access?.userId && userResult.Item
        ? parseStored('users', access.userId, userResult.Item)
        : null;
    if (user && user.email !== email)
      throw new AccountDataError([
        { table: 'whitelist', key: email, fields: ['userId: conflicting link'] },
      ]);
    return { user, access };
  }
  async function getUserByEmail(rawEmail: string): Promise<User | null> {
    const email = rawEmail.trim().toLowerCase();
    const access = await getWhitelistEntry(email);
    if (access?.userId) {
      const user = await getUserById(access.userId);
      if (!user || user.email !== email) throw new AccountError('integrity');
      return user;
    }
    // Legacy discovery is for account management/migration, never the sign-in path.
    let found: User | null = null;
    for await (const items of scanPages('users', {
      FilterExpression: 'email = :email',
      ExpressionAttributeValues: { ':email': email },
      Limit: 100,
    }))
      for (const item of items) {
        if (found) throw new AccountError('integrity');
        found = parseStored('users', typeof item.id === 'string' ? item.id : '<invalid id>', item);
      }
    return found;
  }
  async function getUserById(id: string): Promise<User | null> {
    const result = await client.send(
      new GetCommand({ TableName: accountTable('users'), Key: { id }, ConsistentRead: true }),
    );
    return result.Item ? parseStored('users', id, result.Item) : null;
  }
  async function getAccountSnapshot(
    id: string,
    email: string,
    signal?: AbortSignal,
  ): Promise<AccountSnapshot> {
    const result = await client.send(
      new TransactGetCommand({
        TransactItems: [
          { Get: { TableName: accountTable('users'), Key: { id } } },
          { Get: { TableName: accountTable('whitelist'), Key: { email } } },
        ],
      }),
      { abortSignal: signal },
    );
    return { user: result.Responses?.[0]?.Item, access: result.Responses?.[1]?.Item };
  }
  async function createPreparedAccount(
    prepared: PreparedAccount,
    authority: AccountAuthority,
    bootstrap = false,
    beforeCommit?: () => Promise<void>,
  ): Promise<void> {
    const user = accountRecordSchema.parse(prepared.user);
    if (user.temporaryPasswordExpiresAt !== prepared.expiresAt) throw new AccountError('integrity');
    if (!temporaryCredentialCurrent(user, now())) throw new AccountError('expired');
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
          Item: {
            id: bootstrapId,
            kind: 'bootstrap',
            userId: user.id,
            completedAt: user.createdAt,
          },
          ConditionExpression: 'attribute_not_exists(id)',
        },
      });
    else {
      const initialized = await client.send(
        new GetCommand({
          TableName: accountTable('users'),
          Key: { id: bootstrapId },
          ConsistentRead: true,
        }),
      );
      if (!initialized.Item)
        items.push({
          Update: {
            TableName: accountTable('users'),
            Key: { id: bootstrapId },
            UpdateExpression:
              'SET #kind = if_not_exists(#kind, :kind), userId = if_not_exists(userId, :id), completedAt = if_not_exists(completedAt, :at)',
            ExpressionAttributeNames: { '#kind': 'kind' },
            ExpressionAttributeValues: {
              ':kind': 'initialization',
              ':id': user.id,
              ':at': user.createdAt,
            },
          },
        });
    }
    await beforeCommit?.();
    if (!temporaryCredentialCurrent(user, now())) throw new AccountError('expired');
    await transaction(items, user.id);
  }
  async function adminCreateUser(
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
  async function updateUserPassword(
    user: User,
    newHashedPassword: string,
    authority: AccountAuthority,
    mustChange: boolean,
    temporaryExpiry?: string,
  ): Promise<void> {
    const writtenAt = new Date(now()).toISOString();
    if (mustChange && (!temporaryExpiry || Date.parse(temporaryExpiry) <= now()))
      throw new AccountError('expired');
    if (!mustChange && !temporaryCredentialCurrent(user, now())) throw new AccountError('expired');
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
            'SET password = :password, mustChangePassword = :mustChange, lastPasswordChange = :now, updatedAt = :now, authVersion = :next' +
            (mustChange
              ? ', temporaryPasswordExpiresAt = :expires'
              : ' REMOVE temporaryPasswordExpiresAt'),
          ConditionExpression:
            'attribute_exists(id) AND email = :email AND password = :oldPassword AND ' +
            revisionCondition(user.authVersion) +
            (!mustChange && user.mustChangePassword
              ? ' AND temporaryPasswordExpiresAt = :expectedExpiry AND temporaryPasswordExpiresAt > :now'
              : '') +
            (selfAdmin
              ? ' AND #role = :admin AND (attribute_not_exists(mustChangePassword) OR mustChangePassword = :notRequired)'
              : ''),
          ...(selfAdmin ? { ExpressionAttributeNames: { '#role': 'role' } } : {}),
          ExpressionAttributeValues: {
            ':password': newHashedPassword,
            ':mustChange': mustChange,
            ':now': writtenAt,
            ...(mustChange ? { ':expires': temporaryExpiry } : {}),
            ...(!mustChange && user.mustChangePassword
              ? { ':expectedExpiry': user.temporaryPasswordExpiresAt }
              : {}),
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
  async function changeOwnPassword(user: User, hash: string, session: AccessUser): Promise<void> {
    await updateUserPassword(user, hash, { kind: 'session', ...session }, false);
  }
  async function adminResetPassword(
    email: string,
    authority: AccountAuthority,
  ): Promise<{ email: string; tempPassword: string; expiresAt: string }> {
    const user = await getUserByEmail(email);
    if (!user) throw new AccountError('not-found');
    const prepared = await preparePasswordReset(user);
    await commitPasswordReset(prepared, authority);
    return {
      email: user.email,
      tempPassword: prepared.tempPassword,
      expiresAt: prepared.expiresAt,
    };
  }
  async function listAccounts(): Promise<User[]> {
    const users: User[] = [];
    for await (const items of scanPages('users', { FilterExpression: 'attribute_exists(email)' }))
      for (const item of items)
        users.push(
          parseStored('users', typeof item.id === 'string' ? item.id : '<invalid id>', item),
        );
    return users;
  }
  async function listAccountSummaries(): Promise<AccountSummary[]> {
    const [users, access] = await Promise.all([listAccounts(), getAllWhitelistedEmails()]);
    const byEmail = new Map<string, User>();
    for (const user of users) {
      if (byEmail.has(user.email)) throw new AccountError('integrity');
      byEmail.set(user.email, user);
    }
    const allowed = new Map(access.map((entry) => [entry.email, entry]));
    return [...new Set([...byEmail.keys(), ...allowed.keys()])]
      .sort()
      .map((email) =>
        summarizeAccount(email, byEmail.get(email) ?? null, allowed.get(email) ?? null),
      );
  }
  async function migrateAccountLinks(apply: boolean): Promise<{
    accounts: number;
    linked: number;
    requiresCredentialReissue: { id: string; email: string }[];
  }> {
    // A whitelist entry without an account can still break listing and provisioning.
    // Validate both populations before the first migration write.
    const rawUsers = await scanPopulation('users');
    const rawAccess = await scanPopulation('whitelist');
    const problems: RecordProblem[] = [];
    const users: User[] = [];
    const accessByEmail = new Map<string, WhitelistRecord>();
    for (const item of rawUsers) {
      if (
        item.id === bootstrapId &&
        typeof item.kind === 'string' &&
        ['bootstrap', 'initialization'].includes(item.kind)
      )
        continue;
      try {
        users.push(
          parseStored('users', typeof item.id === 'string' ? item.id : '<invalid id>', item),
        );
      } catch (error) {
        if (!(error instanceof AccountDataError)) throw error;
        problems.push(...error.records);
      }
    }
    for (const item of rawAccess) {
      try {
        const parsed = parseStored(
          'whitelist',
          typeof item.email === 'string' ? item.email : '<invalid email>',
          item,
        );
        accessByEmail.set(parsed.email, parsed);
      } catch (error) {
        if (!(error instanceof AccountDataError)) throw error;
        problems.push(...error.records);
      }
    }
    const emails = new Set<string>();
    for (const user of users) {
      if (emails.has(user.email))
        problems.push({ table: 'users', key: user.id, fields: ['email: duplicate identity'] });
      emails.add(user.email);
      const access = accessByEmail.get(user.email);
      if (access?.userId && access.userId !== user.id)
        problems.push({
          table: 'whitelist',
          key: user.email,
          fields: ['userId: conflicting link'],
        });
    }
    if (problems.length) throw new AccountDataError(problems);
    users.sort((a, b) => a.id.localeCompare(b.id));
    const completed: string[] = [];
    if (apply) {
      for (const user of users) {
        try {
          await transaction([
            {
              ConditionCheck: {
                TableName: accountTable('users'),
                Key: { id: user.id },
                ConditionExpression: 'email = :email AND ' + revisionCondition(user.authVersion),
                ExpressionAttributeValues: { ':email': user.email, ':version': user.authVersion },
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
                ExpressionAttributeValues: {
                  ':id': user.id,
                  ':role': user.role,
                  ':inactive': false,
                },
              },
            },
          ]);
        } catch (error) {
          throw new MigrationInterruptedError(
            [...completed],
            users.slice(completed.length).map((u) => u.id),
            error,
          );
        }
        completed.push(user.id);
      }
    }
    return {
      accounts: users.length,
      linked: apply ? users.length : 0,
      requiresCredentialReissue: users
        .filter((user) => !temporaryCredentialCurrent(user, now()))
        .map((user) => ({ id: user.id, email: user.email })),
    };
  }
  async function scanPopulation(kind: 'users' | 'whitelist'): Promise<Record<string, unknown>[]> {
    const records: Record<string, unknown>[] = [];
    for await (const items of scanPages(kind)) records.push(...items);
    return records;
  }
  async function setAccountAccess(user: User, role: AccountRole, active: boolean): Promise<void> {
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
            ':now': new Date(now()).toISOString(),
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

  async function getWhitelistEntry(email: string): Promise<WhitelistRecord | null> {
    const result = await client.send(
      new GetCommand({
        TableName: accountTable('whitelist'),
        Key: { email: email.trim().toLowerCase() },
        ConsistentRead: true,
      }),
    );
    return result.Item ? parseStored('whitelist', email, result.Item) : null;
  }
  async function getAllWhitelistedEmails(): Promise<WhitelistRecord[]> {
    const entries: WhitelistRecord[] = [];
    for await (const items of scanPages('whitelist'))
      for (const item of items)
        entries.push(
          parseStored(
            'whitelist',
            typeof item.email === 'string' ? item.email : '<invalid email>',
            item,
          ),
        );
    return entries;
  }

  return {
    getUserByEmail,
    getUserById,
    getAccountSnapshot,
    getCredentialSnapshot,
    listAccountSummaries,
    getWhitelistEntry,
    getAllWhitelistedEmails,
    prepareAccount,
    preparePasswordReset,
    commitPasswordReset,
    createPreparedAccount,
    adminCreateUser,
    changeOwnPassword,
    adminResetPassword,
    listAccounts,
    migrateAccountLinks,
    setAccountAccess,
  };
}
export type AccountStore = ReturnType<typeof createAccountStore>;
