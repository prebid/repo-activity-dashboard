import 'server-only';
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient } from '@aws-sdk/lib-dynamodb';
import { isPreviewBuild } from '@/lib/presentation/preview';
import { getRuntimeSettings } from '@/lib/auth/runtime-settings';
let client: DynamoDBDocumentClient | undefined;
export function getDocClient(): DynamoDBDocumentClient {
  if (isPreviewBuild) throw new Error('Account storage is unavailable in preview mode.');
  if (!client) {
    const settings = getRuntimeSettings();
    // Preserve explicit legacy auth credentials; let the SDK handle standard AWS
    // environment/role credentials, including temporary session tokens.
    const accessKeyId = process.env.S3_ACCESS_KEY_ID;
    const secretAccessKey = process.env.S3_SECRET_ACCESS_KEY;
    client = DynamoDBDocumentClient.from(
      new DynamoDBClient({
        region: settings.region,
        maxAttempts: 2,
        requestHandler: { connectionTimeout: 1000, requestTimeout: 3000 },
        ...(!settings.managed && accessKeyId && secretAccessKey
          ? {
              credentials: {
                accessKeyId,
                secretAccessKey,
                sessionToken: process.env.S3_SESSION_TOKEN,
              },
            }
          : {}),
      }),
      { marshallOptions: { removeUndefinedValues: true } },
    );
  }
  return client;
}
