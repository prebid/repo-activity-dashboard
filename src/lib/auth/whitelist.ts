import { GetCommand, ScanCommand } from '@aws-sdk/lib-dynamodb';
import { whitelistRecordSchema, type WhitelistRecord } from '@/models/accounts';
import { getDocClient } from '@/lib/aws/clients';
import { accountTable } from './tables';
export async function getWhitelistEntry(email: string): Promise<WhitelistRecord | null> {
  const result = await getDocClient().send(
    new GetCommand({
      TableName: accountTable('whitelist'),
      Key: { email: email.trim().toLowerCase() },
      ConsistentRead: true,
    }),
  );
  return result.Item ? whitelistRecordSchema.parse(result.Item) : null;
}
export async function isEmailWhitelisted(email: string): Promise<boolean> {
  return (await getWhitelistEntry(email))?.isActive === true;
}
export async function getAllWhitelistedEmails(): Promise<WhitelistRecord[]> {
  const users: WhitelistRecord[] = [];
  let cursor: Record<string, unknown> | undefined;
  const seen = new Set<string>();
  do {
    const result = await getDocClient().send(
      new ScanCommand({
        TableName: accountTable('whitelist'),
        ExclusiveStartKey: cursor,
        ConsistentRead: true,
      }),
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
