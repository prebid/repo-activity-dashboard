import 'server-only';
import { DynamoDBClient, type DynamoDBClientConfig } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient } from '@aws-sdk/lib-dynamodb';
export function createAccountClient(options: {
  region: string;
  credentials?: DynamoDBClientConfig['credentials'];
}): DynamoDBDocumentClient {
  return DynamoDBDocumentClient.from(
    new DynamoDBClient({
      ...options,
      maxAttempts: 2,
      requestHandler: { connectionTimeout: 1000, requestTimeout: 3000 },
    }),
    { marshallOptions: { removeUndefinedValues: true } },
  );
}
