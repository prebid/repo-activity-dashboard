import 'server-only';
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient } from '@aws-sdk/lib-dynamodb';
import { awsClientPolicy } from './client-policy';
export function createAccountClient(options: {
  region: string;
  credentials?: { accessKeyId: string; secretAccessKey: string };
}): DynamoDBDocumentClient {
  return DynamoDBDocumentClient.from(
    new DynamoDBClient({
      ...options,
      ...awsClientPolicy,
    }),
    { marshallOptions: { removeUndefinedValues: true } },
  );
}
