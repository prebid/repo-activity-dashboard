import { getServerAccountStore } from './server-account-store';
export async function getWhitelistEntry(email: string) {
  return getServerAccountStore().getWhitelistEntry(email);
}
export async function isEmailWhitelisted(email: string) {
  return getServerAccountStore().isEmailWhitelisted(email);
}
export async function getAllWhitelistedEmails() {
  return getServerAccountStore().getAllWhitelistedEmails();
}
