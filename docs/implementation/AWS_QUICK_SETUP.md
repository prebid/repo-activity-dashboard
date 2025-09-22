# AWS Authentication Quick Setup Guide

## 🚀 Quick Start Commands

### Step 1: Clone and Setup Project
```bash
cd repo-activity-dashboard
npm install next-auth@beta @auth/dynamodb-adapter \
  @aws-sdk/client-dynamodb @aws-sdk/lib-dynamodb \
  @aws-sdk/client-s3 @aws-sdk/s3-request-presigner \
  bcryptjs uuid @types/bcryptjs @types/uuid
```

### Step 2: Create DynamoDB Tables

**Option A: Using AWS Console (Easier)**
1. Go to https://console.aws.amazon.com/dynamodbv2
2. Create these 4 tables with On-demand billing:
   - `repo-dashboard-users` (partition key: id)
     - **IMPORTANT**: After creation, add Global Secondary Index with partition key: email
   - `repo-dashboard-sessions` (partition key: sessionToken)
   - `repo-dashboard-accounts` (partition key: id)
   - `repo-dashboard-whitelist` (partition key: email)

**Option B: Using AWS CLI**
```bash
# Users table
aws dynamodb create-table \
  --table-name repo-dashboard-users \
  --attribute-definitions AttributeName=id,AttributeType=S AttributeName=email,AttributeType=S \
  --key-schema AttributeName=id,KeyType=HASH \
  --billing-mode PAY_PER_REQUEST \
  --global-secondary-indexes '[{
    "IndexName": "email-index",
    "Keys": [{"AttributeName": "email", "KeyType": "HASH"}],
    "Projection": {"ProjectionType": "ALL"},
    "ProvisionedThroughput": {"ReadCapacityUnits": 1, "WriteCapacityUnits": 1}
  }]'

# Sessions table
aws dynamodb create-table \
  --table-name repo-dashboard-sessions \
  --attribute-definitions AttributeName=sessionToken,AttributeType=S \
  --key-schema AttributeName=sessionToken,KeyType=HASH \
  --billing-mode PAY_PER_REQUEST

# Accounts table (for OAuth logins)
aws dynamodb create-table \
  --table-name repo-dashboard-accounts \
  --attribute-definitions AttributeName=id,AttributeType=S \
  --key-schema AttributeName=id,KeyType=HASH \
  --billing-mode PAY_PER_REQUEST

# Whitelist table
aws dynamodb create-table \
  --table-name repo-dashboard-whitelist \
  --attribute-definitions AttributeName=email,AttributeType=S \
  --key-schema AttributeName=email,KeyType=HASH \
  --billing-mode PAY_PER_REQUEST
```

#### Create S3 Bucket
```bash
# Replace xxx with your account ID
aws s3api create-bucket \
  --bucket repo-dashboard-files-xxx \
  --region us-east-1 \
  --acl private
```

#### Add Initial Authorized Emails
```bash
# Use AWS Console or this command for each email
aws dynamodb put-item \
  --table-name repo-dashboard-authorized-emails \
  --item '{
    "email": {"S": "admin@yourcompany.com"},
    "role": {"S": "admin"},
    "isActive": {"BOOL": true},
    "addedAt": {"N": "'$(date +%s)000'"}
  }'
```

### Step 4: Create Environment File

Create `.env.local`:
```env
NODE_ENV=development
NEXTAUTH_URL=http://localhost:3000
NEXTAUTH_SECRET=$(openssl rand -base64 32)

AWS_REGION=us-east-1
AWS_ACCESS_KEY_ID=YOUR_KEY
AWS_SECRET_ACCESS_KEY=YOUR_SECRET

# Optional Google OAuth
GOOGLE_CLIENT_ID=xxx.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=xxx

# DynamoDB Tables (only 3 needed)
DYNAMODB_USERS_TABLE=repo-dashboard-users
DYNAMODB_ACCOUNTS_TABLE=repo-dashboard-accounts
DYNAMODB_WHITELIST_TABLE=repo-dashboard-whitelist

# S3
S3_BUCKET_NAME=repo-dashboard-files-[your-account-id]
```

### Step 5: File Structure Changes

```bash
# Create auth directories
mkdir -p src/app/auth/{login,register,callback,error,request-access}
mkdir -p src/app/\(protected\)
mkdir -p src/app/api/auth/\[...nextauth\]
mkdir -p src/app/api/auth/register
mkdir -p src/app/api/admin/files/{upload,download}
mkdir -p src/components/auth
mkdir -p src/components/admin
mkdir -p src/lib/aws

# Move existing pages to protected
mv src/app/page.tsx src/app/\(protected\)/page.tsx
mv src/app/contributors src/app/\(protected\)/
mv src/app/companies src/app/\(protected\)/
```

## 📁 Files to Create (Order of Implementation)

### 1. AWS Clients (`src/lib/aws/clients.ts`)
```typescript
import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient } from "@aws-sdk/lib-dynamodb";
import { S3Client } from "@aws-sdk/client-s3";
import { CognitoIdentityProviderClient } from "@aws-sdk/client-cognito-identity-provider";

export const dynamoClient = new DynamoDBClient({
  region: process.env.AWS_REGION
});

export const docClient = DynamoDBDocumentClient.from(dynamoClient);

export const s3Client = new S3Client({
  region: process.env.AWS_REGION
});

export const cognitoClient = new CognitoIdentityProviderClient({
  region: process.env.AWS_REGION
});
```

### 2. DynamoDB Adapter (`src/lib/dynamodb-adapter.ts`)
- Copy from AWS_AUTH_IMPLEMENTATION.md Section 4.2

### 3. NextAuth Config (`src/lib/auth.ts`)
- Copy from AWS_AUTH_IMPLEMENTATION.md Section 4.3

### 4. Middleware (`src/middleware.ts`)
```typescript
export { auth as middleware } from "@/lib/auth";

export const config = {
  matcher: ["/((?!api/auth|auth|_next/static|_next/image|favicon.ico).*)"],
};
```

### 5. Login Page (`src/app/auth/login/page.tsx`)
- Copy from AWS_AUTH_IMPLEMENTATION.md Section 5.1

### 6. Register Page (`src/app/auth/register/page.tsx`)
- Copy from AWS_AUTH_IMPLEMENTATION.md Section 5.2

### 7. Protected Layout (`src/app/(protected)/layout.tsx`)
```typescript
import { auth } from '@/lib/auth';
import { redirect } from 'next/navigation';

export default async function ProtectedLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await auth();

  if (!session) {
    redirect('/auth/login');
  }

  return <>{children}</>;
}
```

### 8. Update Toolbar (`src/components/layout/toolbar.tsx`)
```typescript
// Add to existing toolbar
import { auth } from '@/lib/auth';
import { UserMenu } from './user-menu';

export async function Toolbar() {
  const session = await auth();

  return (
    <header>
      {/* existing navigation */}
      {session && <UserMenu user={session.user} />}
    </header>
  );
}
```

## 🎯 Implementation Order

1. **Day 1: AWS Setup**
   - [ ] Create AWS account and configure CLI
   - [ ] Create Cognito User Pool and App Client
   - [ ] Create all DynamoDB tables
   - [ ] Create S3 bucket
   - [ ] Add authorized emails

2. **Day 2: Core Auth**
   - [ ] Install dependencies
   - [ ] Create AWS client files
   - [ ] Create DynamoDB adapter
   - [ ] Configure NextAuth
   - [ ] Create middleware

3. **Day 3: UI Components**
   - [ ] Create login page
   - [ ] Create register page
   - [ ] Create user menu component
   - [ ] Update toolbar
   - [ ] Move pages to protected folder

4. **Day 4: Admin & Testing**
   - [ ] Create admin dashboard
   - [ ] Add file manager
   - [ ] Test authentication flows
   - [ ] Test file uploads

5. **Day 5: Deployment**
   - [ ] Setup Amplify
   - [ ] Configure environment variables
   - [ ] Deploy application
   - [ ] Test production

## 💰 Cost Monitoring

### Set Budget Alert (Day 1)
```bash
aws budgets create-budget \
  --account-id $(aws sts get-caller-identity --query Account --output text) \
  --budget '{
    "BudgetName": "RepoActivityDashboard",
    "BudgetLimit": {
      "Amount": "20",
      "Unit": "USD"
    },
    "TimeUnit": "MONTHLY",
    "BudgetType": "COST"
  }' \
  --notifications-with-subscribers '[{
    "Notification": {
      "NotificationType": "ACTUAL",
      "ComparisonOperator": "GREATER_THAN",
      "Threshold": 80,
      "ThresholdType": "PERCENTAGE"
    },
    "Subscribers": [{
      "SubscriptionType": "EMAIL",
      "Address": "your-email@example.com"
    }]
  }]'
```

## 🐛 Common Issues Quick Fixes

### Cognito Client Secret Not Working
```bash
# Regenerate secret
aws cognito-idp update-user-pool-client \
  --user-pool-id us-east-1_xxx \
  --client-id xxx \
  --generate-secret
```

### DynamoDB Access Denied
```bash
# Check IAM permissions
aws iam attach-user-policy \
  --user-name your-iam-user \
  --policy-arn arn:aws:iam::aws:policy/AmazonDynamoDBFullAccess
```

### S3 Upload Failing
```bash
# Check CORS
aws s3api put-bucket-cors \
  --bucket repo-dashboard-files-xxx \
  --cors-configuration '{
    "CORSRules": [{
      "AllowedHeaders": ["*"],
      "AllowedMethods": ["GET", "PUT", "POST"],
      "AllowedOrigins": ["http://localhost:3000"],
      "MaxAgeSeconds": 3000
    }]
  }'
```

## 📊 Verify Setup

### Test Cognito
```bash
aws cognito-idp list-users --user-pool-id us-east-1_xxx
```

### Test DynamoDB
```bash
aws dynamodb scan --table-name repo-dashboard-authorized-emails
```

### Test S3
```bash
aws s3 ls s3://repo-dashboard-files-xxx/
```

## 🚢 Deploy to Production

### Amplify Deploy
```bash
amplify init
amplify add hosting
amplify publish
```

### Set Production Environment Variables
1. Go to AWS Amplify Console
2. App settings → Environment variables
3. Add all variables from `.env.local`
4. Change NEXTAUTH_URL to your production URL

## 📝 Notes

- Always use lowercase emails in whitelist
- Cognito passwords require: 8+ chars, uppercase, lowercase, number
- DynamoDB on-demand billing = pay only for what you use
- S3 bucket names must be globally unique
- Lambda functions auto-scale but stay in free tier

## 🔗 Quick Links

- [AWS Console](https://console.aws.amazon.com)
- [Cognito Console](https://console.aws.amazon.com/cognito)
- [DynamoDB Console](https://console.aws.amazon.com/dynamodbv2)
- [S3 Console](https://console.aws.amazon.com/s3)
- [Amplify Console](https://console.aws.amazon.com/amplify)
- [CloudWatch](https://console.aws.amazon.com/cloudwatch)
- [Billing Dashboard](https://console.aws.amazon.com/billing)

---

**Estimated Total Time:** 20-25 hours
**Estimated Monthly Cost:** $5-15
**Users Supported:** Up to 50,000 MAU