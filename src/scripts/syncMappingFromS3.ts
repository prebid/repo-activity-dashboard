#!/usr/bin/env node
import { S3Client, GetObjectCommand } from '@aws-sdk/client-s3';
import { writeFileSync, existsSync, mkdirSync, readFileSync } from 'fs';
import { join } from 'path';
import * as dotenv from 'dotenv';

// Load environment variables
dotenv.config({ path: '.env.local' });
dotenv.config({ path: '.env' }); // Also try .env if .env.local doesn't exist

/**
 * Syncs the GitHub mapping file from S3 to local store
 * This runs before build to ensure we have the latest mapping data
 */
async function syncMappingFromS3() {
  const localPath = join(process.cwd(), 'store/sheets/github-mapping.json');

  // Skip in development if file already exists and S3 is not configured
  if (process.env.NODE_ENV === 'development' && existsSync(localPath) && !process.env.S3_BUCKET_NAME) {
    console.log('📁 Using existing local github-mapping.json in development');
    try {
      const data = readFileSync(localPath, 'utf8');
      const mapping = JSON.parse(data);
      console.log(`   └─ ${Object.keys(mapping.mapping || {}).length} contributors mapped`);
    } catch (error) {
      console.log('   └─ Warning: Could not parse local file');
    }
    return;
  }

  // Check for S3 configuration - try both naming conventions
  const accessKeyId = process.env.S3_ACCESS_KEY_ID || process.env.AWS_ACCESS_KEY_ID;
  const secretAccessKey = process.env.S3_SECRET_ACCESS_KEY || process.env.AWS_SECRET_ACCESS_KEY;
  const region = process.env.S3_REGION || process.env.AWS_REGION || 'us-east-1';

  // Skip if no S3 configuration
  if (!accessKeyId || !secretAccessKey) {
    console.log('⚠️  No AWS credentials found in environment');

    // Check if local file exists
    if (existsSync(localPath)) {
      console.log('   └─ Using existing local file');
      return;
    } else {
      console.error('❌ No local mapping file and cannot fetch from S3');
      console.error('   Please ensure github-mapping.json exists or configure AWS credentials');
      if (process.env.NODE_ENV === 'production') {
        process.exit(1);
      }
      return;
    }
  }

  const bucketName = process.env.S3_BUCKET_NAME || 'prebid-dashboard-data';

  console.log('🔄 Fetching GitHub mapping from S3...');
  console.log(`   ├─ Bucket: ${bucketName}`);
  console.log(`   └─ Region: ${region}`);

  // Configure S3 client
  const s3Client = new S3Client({
    region,
    credentials: {
      accessKeyId: accessKeyId!,
      secretAccessKey: secretAccessKey!,
    },
  });

  try {
    // Fetch from S3
    const command = new GetObjectCommand({
      Bucket: bucketName,
      Key: 'github-mapping.json',
    });

    const response = await s3Client.send(command);
    const data = await response.Body?.transformToString();

    if (!data) {
      throw new Error('No data received from S3');
    }

    // Parse to validate JSON
    const mappingData = JSON.parse(data);

    // Validate structure
    if (!mappingData.mapping || typeof mappingData.mapping !== 'object') {
      throw new Error('Invalid mapping structure');
    }

    // Ensure directory exists
    const dir = join(process.cwd(), 'store/sheets');
    if (!existsSync(dir)) {
      mkdirSync(dir, { recursive: true });
    }

    // Write the file
    writeFileSync(localPath, JSON.stringify(mappingData, null, 2));

    console.log('✅ Successfully synced GitHub mapping from S3');
    console.log(`   ├─ Saved to: store/sheets/github-mapping.json`);
    console.log(`   ├─ Contributors: ${Object.keys(mappingData.mapping).length}`);
    console.log(`   ├─ Member companies: ${mappingData.metadata?.memberCount || 0}`);
    console.log(`   └─ Non-member companies: ${mappingData.metadata?.nonMemberCount || 0}`);

    // Also copy to public directory for client-side access if needed
    const publicPath = join(process.cwd(), 'public/store/sheets');
    if (!existsSync(publicPath)) {
      mkdirSync(publicPath, { recursive: true });
    }
    writeFileSync(join(publicPath, 'github-mapping.json'), JSON.stringify(mappingData, null, 2));

  } catch (error: any) {
    console.error('❌ Error fetching from S3:', error.message);

    // In production, check if we have a fallback local file
    if (process.env.NODE_ENV === 'production') {
      if (existsSync(localPath)) {
        console.log('   └─ Using existing local file as fallback');
      } else {
        console.error('   └─ No fallback file available, build will fail');
        process.exit(1);
      }
    }
  }
}

// Run the sync
syncMappingFromS3()
  .then(() => process.exit(0))
  .catch(() => process.exit(1));

export default syncMappingFromS3;