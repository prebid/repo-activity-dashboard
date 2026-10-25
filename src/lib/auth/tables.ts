import { getRuntimeSettings } from './runtime-settings';
export function accountTable(kind: 'users' | 'whitelist'): string {
  const variable = kind === 'users' ? 'DYNAMODB_USERS_TABLE' : 'DYNAMODB_WHITELIST_TABLE';
  const settings = getRuntimeSettings();
  const name = kind === 'users' ? settings.usersTable : settings.whitelistTable;
  if (!name) throw new Error('Missing account-store configuration: ' + variable);
  return name;
}
