// @vitest-environment node
import { beforeEach, afterEach, it, expect, vi } from 'vitest';
import { ScanCommand, GetCommand, PutCommand, UpdateCommand } from '@aws-sdk/lib-dynamodb';
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
};
beforeEach(() => {
  send.mockReset();
  vi.stubEnv('DYNAMODB_USERS_TABLE', 'users');
  vi.stubEnv('DYNAMODB_WHITELIST_TABLE', 'whitelist');
});
afterEach(() => vi.unstubAllEnvs());
it('continues past empty filtered scan pages to find the account', async () => {
  send
    .mockResolvedValueOnce({ Items: [], LastEvaluatedKey: { id: 'cursor' } })
    .mockResolvedValueOnce({ Items: [record] });
  expect(await getUserByEmail('USER@example.test')).toEqual(record);
  expect(send).toHaveBeenNthCalledWith(1, expect.any(ScanCommand));
  const second = send.mock.calls[1][0];
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
  await expect(getUserByEmail(record.email)).rejects.toThrow('did not advance');
  expect(send).toHaveBeenCalledTimes(2);
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
    'admin@example.test',
  );
  expect(user.email).toBe('new@example.test');
  expect(user.mustChangePassword).toBe(true);
  expect(user.password).not.toBe(tempPassword);
  expect(await verifyPassword(tempPassword, user.password)).toBe(true);
  expect(await verifyPassword('wrong-password', user.password)).toBe(false);
  const put = send.mock.calls[1][0];
  const whitelist = send.mock.calls[2][0];
  if (!(put instanceof PutCommand) || !(whitelist instanceof PutCommand))
    throw new Error('Expected account and whitelist writes');
  expect(put.input.Item).toMatchObject({
    id: user.id,
    createdBy: 'admin@example.test',
    mustChangePassword: true,
  });
  expect(whitelist.input).toMatchObject({
    TableName: 'whitelist',
    Item: {
      email: 'new@example.test',
      isActive: true,
      role: 'viewer',
      addedBy: 'admin@example.test',
    },
  });
});
it('does not overwrite an existing account or continue after a failed account write', async () => {
  send.mockResolvedValue({ Items: [record] });
  await expect(adminCreateUser(record.email)).rejects.toThrow('already exists');
  expect(send).toHaveBeenCalledTimes(1);
  send.mockReset();
  send.mockResolvedValueOnce({}).mockRejectedValueOnce(new Error('write failed'));
  await expect(adminCreateUser('new@example.test')).rejects.toThrow('write failed');
  expect(send).toHaveBeenCalledTimes(2);
});
it('sets and clears mandatory password-change state in the correct operations', async () => {
  send.mockResolvedValueOnce({ Items: [record] }).mockResolvedValue({});
  const reset = await adminResetPassword(record.email);
  const command = send.mock.calls[1][0];
  if (!(command instanceof UpdateCommand)) throw new Error('Expected password update');
  const password: unknown = command.input.ExpressionAttributeValues?.[':password'];
  if (typeof password !== 'string') throw new Error('Missing password hash');
  expect(await verifyPassword(reset.tempPassword, password)).toBe(true);
  expect(command.input.ExpressionAttributeValues?.[':mustChange']).toBe(true);
  await updateUserPassword(record.id, 'replacement-hash');
  const changed = send.mock.calls[2][0];
  if (!(changed instanceof UpdateCommand)) throw new Error('Expected own-password update');
  expect(changed.input).toMatchObject({
    Key: { id: record.id },
    ExpressionAttributeValues: { ':password': 'replacement-hash', ':mustChange': false },
  });
});
it('rejects missing table configuration and resets of absent users', async () => {
  send.mockResolvedValue({});
  await expect(adminResetPassword(record.email)).rejects.toThrow('User not found');
  send.mockClear();
  vi.stubEnv('DYNAMODB_USERS_TABLE', '');
  await expect(getUserById('u1')).rejects.toThrow('Missing account-store configuration');
  expect(send).not.toHaveBeenCalled();
});
