import { GetCommand, PutCommand, ScanCommand, UpdateCommand } from '@aws-sdk/lib-dynamodb';
import { randomInt, randomUUID } from 'node:crypto';
import { accountRecordSchema, type AccountRecord } from '@/models/accounts';
import { getDocClient } from '@/lib/aws/clients';
import { accountTable } from './tables';
export type User = AccountRecord;
export async function getUserByEmail(email: string): Promise<User | null> {
  let cursor: Record<string, unknown> | undefined;
  const seen = new Set<string>();
  do {
    const result = await getDocClient().send(
      new ScanCommand({
        TableName: accountTable('users'),
        FilterExpression: 'email = :email',
        ExpressionAttributeValues: { ':email': email.toLowerCase() },
        Limit: 100,
        ExclusiveStartKey: cursor,
      }),
    );
    if (result.Items?.length) return accountRecordSchema.parse(result.Items[0]);
    cursor = result.LastEvaluatedKey;
    if (cursor && Object.keys(cursor).length) {
      const key = JSON.stringify(cursor);
      if (seen.has(key)) throw new Error('Account pagination did not advance');
      seen.add(key);
    }
  } while (cursor && Object.keys(cursor).length);
  return null;
}
export async function getUserById(id: string): Promise<User | null> {
  const result = await getDocClient().send(
    new GetCommand({ TableName: accountTable('users'), Key: { id } }),
  );
  return result.Item ? accountRecordSchema.parse(result.Item) : null;
}
export async function createUser(userData: {
  email: string;
  password: string;
  name?: string;
  role?: string;
  company?: string;
}): Promise<User> {
  const user: User = {
    id: randomUUID(),
    email: userData.email.toLowerCase(),
    password: userData.password,
    name: userData.name || userData.email.split('@')[0],
    role: userData.role || 'viewer',
    company: userData.company,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
  await getDocClient().send(new PutCommand({ TableName: accountTable('users'), Item: user }));
  return user;
}
export function generateTempPassword(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789!@#$';
  let password = '';
  for (let i = 0; i < 12; i++) password += chars.charAt(randomInt(chars.length));
  return password;
}
export async function adminCreateUser(
  email: string,
  name?: string,
  role = 'viewer',
  company?: string,
  createdBy = 'admin',
): Promise<{ user: User; tempPassword: string }> {
  if (await getUserByEmail(email)) throw new Error('User already exists');
  const tempPassword = generateTempPassword();
  const { hashPassword } = await import('./passwords');
  const user: User = {
    id: randomUUID(),
    email: email.toLowerCase(),
    password: await hashPassword(tempPassword),
    name: name || email.split('@')[0],
    role,
    company,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    createdBy,
    mustChangePassword: true,
  };
  await getDocClient().send(new PutCommand({ TableName: accountTable('users'), Item: user }));
  const { addToWhitelist } = await import('./whitelist');
  await addToWhitelist(email, role, createdBy);
  return { user, tempPassword };
}
export async function updateUserPassword(userId: string, newHashedPassword: string): Promise<void> {
  await getDocClient().send(
    new UpdateCommand({
      TableName: accountTable('users'),
      Key: { id: userId },
      UpdateExpression:
        'SET password = :password, mustChangePassword = :mustChange, lastPasswordChange = :lastChange, updatedAt = :updatedAt',
      ExpressionAttributeValues: {
        ':password': newHashedPassword,
        ':mustChange': false,
        ':lastChange': new Date().toISOString(),
        ':updatedAt': new Date().toISOString(),
      },
    }),
  );
}
export async function adminResetPassword(email: string): Promise<{ tempPassword: string }> {
  const user = await getUserByEmail(email);
  if (!user) throw new Error('User not found');
  const tempPassword = generateTempPassword();
  const { hashPassword } = await import('./passwords');
  await getDocClient().send(
    new UpdateCommand({
      TableName: accountTable('users'),
      Key: { id: user.id },
      UpdateExpression:
        'SET password = :password, mustChangePassword = :mustChange, updatedAt = :updatedAt',
      ExpressionAttributeValues: {
        ':password': await hashPassword(tempPassword),
        ':mustChange': true,
        ':updatedAt': new Date().toISOString(),
      },
    }),
  );
  return { tempPassword };
}
