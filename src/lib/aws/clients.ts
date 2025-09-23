import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient } from "@aws-sdk/lib-dynamodb";
import { S3Client } from "@aws-sdk/client-s3";

// Create a function to get config at runtime
function getAWSConfig() {
  console.log('[AWS Config] Getting config at:', new Date().toISOString());
  console.log('[AWS Config] Caller:', new Error().stack?.split('\n')[2]);
  console.log('[AWS Config] ENV check:');
  console.log('  S3_ACCESS_KEY_ID exists:', !!process.env.S3_ACCESS_KEY_ID);
  console.log('  S3_SECRET_ACCESS_KEY exists:', !!process.env.S3_SECRET_ACCESS_KEY);
  console.log('  S3_REGION:', process.env.S3_REGION);
  console.log('  AWS_REGION:', process.env.AWS_REGION);

  const accessKeyId = process.env.S3_ACCESS_KEY_ID || process.env.AWS_ACCESS_KEY_ID;
  const secretAccessKey = process.env.S3_SECRET_ACCESS_KEY || process.env.AWS_SECRET_ACCESS_KEY;
  const region = process.env.DYNAMODB_REGION || process.env.S3_REGION || process.env.AWS_REGION || 'us-east-2';

  const config: any = { region };

  if (accessKeyId && secretAccessKey) {
    console.log('[AWS Config] Using explicit credentials');
    config.credentials = { accessKeyId, secretAccessKey };
  } else {
    console.log('[AWS Config] No credentials found, will use default provider chain');
  }

  return config;
}

// Create clients lazily
let _dynamoClient: DynamoDBClient | null = null;
let _docClient: DynamoDBDocumentClient | null = null;
let _s3Client: S3Client | null = null;

export const dynamoClient = new Proxy({} as DynamoDBClient, {
  get(target, prop) {
    if (!_dynamoClient) {
      console.log('[AWS Clients] Creating DynamoDB client on first use');
      _dynamoClient = new DynamoDBClient(getAWSConfig());
    }
    return (_dynamoClient as any)[prop];
  }
});

export const docClient = new Proxy({} as DynamoDBDocumentClient, {
  get(target, prop) {
    if (!_docClient) {
      console.log('[AWS Clients] Creating DocumentClient on first use');
      if (!_dynamoClient) {
        _dynamoClient = new DynamoDBClient(getAWSConfig());
      }
      _docClient = DynamoDBDocumentClient.from(_dynamoClient);
    }
    return (_docClient as any)[prop];
  }
});

export const s3Client = new Proxy({} as S3Client, {
  get(target, prop) {
    if (!_s3Client) {
      console.log('[AWS Clients] Creating S3 client on first use');
      _s3Client = new S3Client(getAWSConfig());
    }
    return (_s3Client as any)[prop];
  }
});