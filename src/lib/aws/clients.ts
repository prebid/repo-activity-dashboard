import 'server-only';
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient } from '@aws-sdk/lib-dynamodb';
import { isPreviewBuild } from '@/lib/presentation/preview';
let client: DynamoDBDocumentClient | undefined;
export function getDocClient(): DynamoDBDocumentClient {
  if (isPreviewBuild) throw new Error('Account storage is unavailable in preview mode.');
  if (!client) {
    // Preserve explicit legacy auth credentials; let the SDK handle standard AWS
    // environment/role credentials, including temporary session tokens.
    const accessKeyId = process.env.S3_ACCESS_KEY_ID;
    const secretAccessKey = process.env.S3_SECRET_ACCESS_KEY;
    client = DynamoDBDocumentClient.from(
      new DynamoDBClient({
        region:
          process.env.DYNAMODB_REGION ||
          process.env.AWS_REGION ||
          process.env.S3_REGION ||
          'us-east-2',
        ...(accessKeyId && secretAccessKey
          ? {
              credentials: {
                accessKeyId,
                secretAccessKey,
                sessionToken: process.env.S3_SESSION_TOKEN,
              },
            }
          : {}),
      }),
    );
  }
  return client;
}
