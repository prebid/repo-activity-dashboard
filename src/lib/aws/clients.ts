import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient } from "@aws-sdk/lib-dynamodb";
import { S3Client } from "@aws-sdk/client-s3";

// Only use explicit credentials if they exist, otherwise use IAM role
const accessKeyId = process.env.S3_ACCESS_KEY_ID || process.env.AWS_ACCESS_KEY_ID;
const secretAccessKey = process.env.S3_SECRET_ACCESS_KEY || process.env.AWS_SECRET_ACCESS_KEY;

const config: any = {
  region: process.env.DYNAMODB_REGION || process.env.S3_REGION || process.env.AWS_REGION || 'us-east-2',
};

// Only add credentials if both are present
if (accessKeyId && secretAccessKey) {
  config.credentials = {
    accessKeyId,
    secretAccessKey,
  };
}

export const dynamoClient = new DynamoDBClient(config);
export const docClient = DynamoDBDocumentClient.from(dynamoClient);
export const s3Client = new S3Client(config);