import 'server-only';
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient } from '@aws-sdk/lib-dynamodb';
import { awsClientPolicy } from './client-policy';
export function createAccountClient(options: { region: string }): DynamoDBDocumentClient {
  return DynamoDBDocumentClient.from(
    new DynamoDBClient({
      ...options,
      ...awsClientPolicy,
    }),
    { marshallOptions: { removeUndefinedValues: true } },
  );
}
