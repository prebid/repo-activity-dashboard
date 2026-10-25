// Explicit account-test configuration. Real file/env parsing has its own boundary tests.
export function getRuntimeSettings() {
  return {
    version: 1 as const,
    managed: false,
    region: 'us-east-2',
    usersTable: process.env.DYNAMODB_USERS_TABLE,
    whitelistTable: process.env.DYNAMODB_WHITELIST_TABLE,
    authUrl: process.env.AUTH_URL || process.env.NEXTAUTH_URL,
    secretArn: process.env.DASHBOARD_AUTH_SECRET_ARN || undefined,
  };
}
