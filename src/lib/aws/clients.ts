import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient } from "@aws-sdk/lib-dynamodb";
import { S3Client } from "@aws-sdk/client-s3";

const config = {
  region: process.env.DYNAMODB_REGION || process.env.S3_REGION || process.env.AWS_REGION || 'us-east-2',
  credentials: {
    accessKeyId: process.env.S3_ACCESS_KEY_ID || process.env.AWS_ACCESS_KEY_ID || '',
    secretAccessKey: process.env.S3_SECRET_ACCESS_KEY || process.env.AWS_SECRET_ACCESS_KEY || '',
  },
};

export const dynamoClient = new DynamoDBClient(config);
export const docClient = DynamoDBDocumentClient.from(dynamoClient);
export const s3Client = new S3Client(config);