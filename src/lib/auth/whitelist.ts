import { GetCommand, PutCommand, ScanCommand } from '@aws-sdk/lib-dynamodb';
import { whitelistRecordSchema, type WhitelistRecord } from '@/models/accounts';
import { getDocClient } from '@/lib/aws/clients';
import { accountTable } from './tables';
export async function isEmailWhitelisted(email: string): Promise<boolean> {
  const result = await getDocClient().send(
    new GetCommand({ TableName: accountTable('whitelist'), Key: { email: email.toLowerCase() } }),
  );
  return result.Item ? whitelistRecordSchema.parse(result.Item).isActive : false;
}
export async function addToWhitelist(
  email: string,
  role = 'viewer',
  addedBy = 'system',
): Promise<void> {
  await getDocClient().send(
    new PutCommand({
      TableName: accountTable('whitelist'),
      Item: {
        email: email.toLowerCase(),
        isActive: true,
        role,
        addedBy,
        addedAt: new Date().toISOString(),
      },
    }),
  );
}
export async function getAllWhitelistedEmails(): Promise<WhitelistRecord[]> {
  const users: WhitelistRecord[] = [];
  let cursor: Record<string, unknown> | undefined;
  const seen = new Set<string>();
  do {
    const result = await getDocClient().send(
      new ScanCommand({ TableName: accountTable('whitelist'), ExclusiveStartKey: cursor }),
    );
    users.push(...(result.Items ?? []).map((item) => whitelistRecordSchema.parse(item)));
    cursor = result.LastEvaluatedKey;
    if (cursor && Object.keys(cursor).length) {
      const key = JSON.stringify(cursor);
      if (seen.has(key)) throw new Error('Whitelist pagination did not advance');
      seen.add(key);
    }
  } while (cursor && Object.keys(cursor).length);
  return users;
}
