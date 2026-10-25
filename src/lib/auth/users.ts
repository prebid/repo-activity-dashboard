import { getServerAccountStore } from './server-account-store';
import type { AccountRole } from '@/models/accounts';
import type { AccountAuthority, User } from './account-store';
export { generateTempPassword } from './account-store';
export type { User, AccountAuthority } from './account-store';
export async function getUserByEmail(email: string) {
  return getServerAccountStore().getUserByEmail(email);
}
export async function getUserById(id: string) {
  return getServerAccountStore().getUserById(id);
}
export async function getAccountSnapshot(id: string, email: string) {
  return getServerAccountStore().getAccountSnapshot(id, email);
}
export async function adminCreateUser(
  email: string,
  name: string | undefined,
  role: AccountRole,
  company: string | undefined,
  authority: AccountAuthority,
) {
  return getServerAccountStore().adminCreateUser(email, name, role, company, authority);
}
export async function updateUserPassword(
  user: User,
  hash: string,
  authority: AccountAuthority,
  mustChange: boolean,
) {
  return getServerAccountStore().updateUserPassword(user, hash, authority, mustChange);
}
export async function adminResetPassword(email: string, authority: AccountAuthority) {
  return getServerAccountStore().adminResetPassword(email, authority);
}
