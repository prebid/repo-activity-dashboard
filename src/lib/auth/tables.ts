export function accountTable(kind: 'users' | 'whitelist'): string {
  const variable = kind === 'users' ? 'DYNAMODB_USERS_TABLE' : 'DYNAMODB_WHITELIST_TABLE';
  const name = process.env[variable];
  if (!name) throw new Error('Missing account-store configuration: ' + variable);
  return name;
}
