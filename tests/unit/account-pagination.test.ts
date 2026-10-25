// @vitest-environment node
vi.mock('@/lib/auth/runtime-settings', () => import('../fakes/runtime-settings'));
import { beforeEach, afterEach, it, expect, vi } from 'vitest';
import { ScanCommand, GetCommand, TransactWriteCommand } from '@aws-sdk/lib-dynamodb';
const send = vi.hoisted(() => vi.fn<(command: unknown) => Promise<Record<string, unknown>>>());
vi.mock('@/lib/aws/clients', () => ({ getDocClient: () => ({ send }) }));
import {
  getUserByEmail,
  getUserById,
  adminCreateUser,
  adminResetPassword,
  updateUserPassword,
} from '@/lib/auth/users';
import { verifyPassword } from '@/lib/auth/passwords';
import { getAllWhitelistedEmails, isEmailWhitelisted } from '@/lib/auth/whitelist';
const record = {
  id: 'u1',
  email: 'user@example.test',
  password: 'hash',
  createdAt: '',
  updatedAt: '',
  role: 'viewer' as const,
  authVersion: 0,
};
beforeEach(() => {
  send.mockReset();
  vi.stubEnv('DYNAMODB_USERS_TABLE', 'users');
  vi.stubEnv('DYNAMODB_WHITELIST_TABLE', 'whitelist');
});
afterEach(() => vi.unstubAllEnvs());
it('continues past empty filtered scan pages to find the account', async () => {
  send
    .mockResolvedValueOnce({})
    .mockResolvedValueOnce({ Items: [], LastEvaluatedKey: { id: 'cursor' } })
    .mockResolvedValueOnce({ Items: [record] });
  expect(await getUserByEmail('USER@example.test')).toEqual(record);
  expect(send).toHaveBeenNthCalledWith(2, expect.any(ScanCommand));
  const second = send.mock.calls[2][0];
  expect(second).toBeInstanceOf(ScanCommand);
  if (!(second instanceof ScanCommand)) throw new Error('Expected account scan');
  expect(second.input).toMatchObject({
    ExclusiveStartKey: { id: 'cursor' },
    ExpressionAttributeValues: { ':email': 'user@example.test' },
  });
});
it('collects all whitelist pages without silently truncating', async () => {
  send
    .mockResolvedValueOnce({
      Items: [{ email: 'a@example.test', isActive: true }],
      LastEvaluatedKey: { email: 'a@example.test' },
    })
    .mockResolvedValueOnce({ Items: [{ email: 'b@example.test', isActive: false }] });
  expect((await getAllWhitelistedEmails()).map((x) => x.email)).toEqual([
    'a@example.test',
    'b@example.test',
  ]);
  expect(send).toHaveBeenCalledTimes(2);
});
it('distinguishes absent data, invalid records, and backend failures', async () => {
  send.mockResolvedValue({});
  expect(await getUserByEmail(record.email)).toBeNull();
  expect(await getUserById('u1')).toBeNull();
  expect(await isEmailWhitelisted(record.email)).toBe(false);
  send.mockResolvedValue({ Item: record });
  expect(await getUserById('u1')).toEqual(record);
  expect(send).toHaveBeenLastCalledWith(expect.any(GetCommand));
  send.mockResolvedValue({ Item: { email: record.email, isActive: 'yes' } });
  await expect(isEmailWhitelisted(record.email)).rejects.toThrow();
  send.mockRejectedValue(new Error('offline'));
  await expect(getUserByEmail(record.email)).rejects.toThrow('offline');
  await expect(getAllWhitelistedEmails()).rejects.toThrow('offline');
});
it('rejects non-advancing cursors rather than looping indefinitely', async () => {
  send.mockResolvedValue({ Items: [], LastEvaluatedKey: { id: 'same' } });
  await expect(getUserByEmail(record.email)).rejects.toThrow('operator attention');
  expect(send).toHaveBeenCalledTimes(3);
  send.mockClear();
  await expect(getAllWhitelistedEmails()).rejects.toThrow('did not advance');
  expect(send).toHaveBeenCalledTimes(2);
});
it('stores a hash, requires a password change, and records the provisioning actor', async () => {
  send.mockResolvedValue({});
  const { user, tempPassword } = await adminCreateUser(
    'NEW@example.test',
    'New User',
    'viewer',
    'Company',
    { kind: 'session', id: 'admin', email: 'admin@example.test', role: 'admin', authVersion: 0 },
  );
  expect(user.email).toBe('new@example.test');
  expect(user.mustChangePassword).toBe(true);
  expect(user.password).not.toBe(tempPassword);
  expect(await verifyPassword(tempPassword, user.password)).toBe(true);
  expect(await verifyPassword('wrong-password', user.password)).toBe(false);
  const write = send.mock.calls[2][0];
  if (!(write instanceof TransactWriteCommand))
    throw new Error('Expected atomic account provisioning');
  expect(write.input.TransactItems?.[0].Put?.Item).toMatchObject({
    id: user.id,
    createdBy: 'admin@example.test',
    mustChangePassword: true,
    authVersion: 1,
  });
  expect(write.input.TransactItems?.[1].Update).toMatchObject({
    TableName: 'whitelist',
    Key: { email: 'new@example.test' },
    ConditionExpression: 'attribute_not_exists(userId)',
  });
  expect(write.input.TransactItems).toHaveLength(4); // User + claim + two current-admin conditions.
});

it('does not overwrite an existing account or continue after a failed account write', async () => {
  send.mockResolvedValue({ Items: [record] });
  await expect(
    adminCreateUser(record.email, undefined, 'viewer', undefined, { kind: 'operator' }),
  ).rejects.toThrow('already exists');
  expect(send).toHaveBeenCalledTimes(2);
  send.mockReset();
  send
    .mockResolvedValueOnce({})
    .mockResolvedValueOnce({})
    .mockRejectedValueOnce(new Error('write failed'));
  await expect(
    adminCreateUser('new@example.test', undefined, 'viewer', undefined, { kind: 'operator' }),
  ).rejects.toThrow('write failed');
  expect(send).toHaveBeenCalledTimes(3);
});
it('sets and clears mandatory password-change state in the correct operations', async () => {
  send
    .mockResolvedValueOnce({})
    .mockResolvedValueOnce({ Items: [record] })
    .mockResolvedValue({});
  const reset = await adminResetPassword(record.email, { kind: 'operator' });
  const command = send.mock.calls[2][0];
  if (!(command instanceof TransactWriteCommand))
    throw new Error('Expected atomic password update');
  const update = command.input.TransactItems?.[0].Update;
  const password: unknown = update?.ExpressionAttributeValues?.[':password'];
  if (typeof password !== 'string') throw new Error('Missing password hash');
  expect(await verifyPassword(reset.tempPassword, password)).toBe(true);
  expect(update?.ExpressionAttributeValues?.[':mustChange']).toBe(true);
  expect(update?.ExpressionAttributeValues?.[':next']).toBe(1);
  await updateUserPassword(
    { ...record, password, authVersion: 1 },
    'replacement-hash',
    { kind: 'operator' },
    false,
  );
  const changed = send.mock.calls[3][0];
  if (!(changed instanceof TransactWriteCommand))
    throw new Error('Expected atomic own-password update');
  expect(changed.input.TransactItems?.[0].Update).toMatchObject({
    Key: { id: record.id },
    ExpressionAttributeValues: {
      ':password': 'replacement-hash',
      ':mustChange': false,
      ':next': 2,
      ':version': 1,
    },
  });
});
it('rejects missing table configuration and resets of absent users', async () => {
  send.mockResolvedValue({});
  await expect(adminResetPassword(record.email, { kind: 'operator' })).rejects.toThrow(
    'User not found',
  );
  send.mockClear();
  vi.stubEnv('DYNAMODB_USERS_TABLE', '');
  await expect(getUserById('u1')).rejects.toThrow('Missing account-store configuration');
  expect(send).not.toHaveBeenCalled();
});
