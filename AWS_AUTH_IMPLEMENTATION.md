# AWS Authentication Implementation Guide

## Table of Contents
1. [Overview](#overview)
2. [Architecture](#architecture)
3. [Cost Analysis](#cost-analysis)
4. [AWS Services Setup](#aws-services-setup)
5. [Application Implementation](#application-implementation)
6. [Deployment Guide](#deployment-guide)
7. [Monitoring & Maintenance](#monitoring--maintenance)
8. [Troubleshooting](#troubleshooting)

---

## Overview

This document provides a complete guide for implementing authentication for the Repository Activity Dashboard using NextAuth.js with AWS services, optimized for minimal cost while maintaining enterprise-grade security.

### Key Features
- **Dual Authentication**: Google OAuth AND username/password login
- **Email Whitelist**: Only authorized emails can access
- **File Hosting**: S3 storage for GitHub mapping files (CSV/JSON/Excel)
- **Admin Panel**: Manage users and authorized emails
- **Cost-Optimized**: $2-10/month total AWS costs

### Technology Stack
- **Frontend**: Next.js 14 with TypeScript
- **Authentication**: NextAuth.js v5 (beta)
- **AWS Services**:
  - DynamoDB (Database for users, sessions, whitelist)
  - S3 (File storage)
  - CloudWatch (Monitoring)
  - Amplify or Vercel (Hosting)

---

## Architecture

### System Architecture Diagram
```
┌──────────────────────────────────────────────────────────────┐
│                    Next.js Application                        │
│                (Hosted on Amplify/Vercel)                     │
│                                                               │
│  ┌─────────────────────────────────────────────────────┐     │
│  │                  NextAuth.js                        │     │
│  │  • Email/Password Authentication                    │     │
│  │  • Google OAuth Integration                         │     │
│  │  • Session Management                               │     │
│  │  • Whitelist Validation                             │     │
│  └─────────────────────────────────────────────────────┘     │
│                                                               │
│  ┌─────────────────────────────────────────────────────┐     │
│  │                   API Routes                        │     │
│  │  • /api/auth/[...nextauth] - Auth endpoints        │     │
│  │  • /api/auth/register - User registration          │     │
│  │  • /api/admin/files - File management              │     │
│  │  • /api/admin/whitelist - Email whitelist          │     │
│  └─────────────────────────────────────────────────────┘     │
└────────────────────────┬──────────────────────────────────────┘
                         │
                         ▼
┌───────────────────────────────────────────────────────────────┐
│                        AWS Services                           │
│                                                               │
│  ┌─────────────────┐              ┌─────────────────────┐    │
│  │   DynamoDB       │              │     S3 Bucket       │    │
│  │   Tables:        │              │     Files:          │    │
│  │  • users         │              │     • mappings/     │    │
│  │  • accounts      │              │       ├── .csv      │    │
│  │  • whitelist     │              │       ├── .json     │    │
│  │                  │              │       └── .xlsx     │    │
│  └─────────────────┘              └─────────────────────┘    │
│                                                               │
│  ┌──────────────────────────────────────────────────────┐    │
│  │                   CloudWatch                         │    │
│  │  • Application Logs                                  │    │
│  │  • Basic Metrics (Free Tier)                         │    │
│  └──────────────────────────────────────────────────────┘    │
└───────────────────────────────────────────────────────────────┘
```

### Data Flow

#### Authentication Flow (JWT-based)
1. User visits dashboard → Redirected to login
2. Choose authentication method:
   - **Google OAuth**: NextAuth → Google → Callback → JWT token
   - **Username/Password**: Credentials → NextAuth validation → JWT token
3. NextAuth checks email against DynamoDB whitelist
4. JWT token created and stored in httpOnly cookie
5. User accesses protected routes with JWT

#### File Management Flow
1. Admin uploads file through UI
2. API generates pre-signed S3 URL
3. Direct upload to S3 bucket
4. Update metadata in DynamoDB
5. Files available for download

---

## Cost Analysis

### Monthly Cost Breakdown

| Service | Free Tier | Usage | Cost |
|---------|-----------|-------|------|
| **DynamoDB** | 25 GB storage, 25 RCU/WCU | On-demand billing | **$0-3** |
| **S3** | 5 GB storage, 20k GET | ~100MB files | **$0.50** |
| **CloudWatch** | 5 GB logs, basic metrics | Minimal logging | **$0** |
| **Hosting** | Varies by provider | Vercel/Amplify | **$0-10** |
| | | **TOTAL:** | **$0.50-13.50/month** |

### Cost Optimization Strategies
1. **DynamoDB On-Demand**: Pay only for actual usage
2. **S3 Lifecycle Policies**: Auto-delete old versions after 30 days
3. **CloudWatch Logs Retention**: Set to 7 days
4. **Optimize Build Process**: Minimize build minutes if using Amplify
5. **Use Vercel Free Tier**: 100GB bandwidth free

### Cost Comparison
- **With NextAuth + DynamoDB**: $2-10/month
- **Alternative with RDS**: $40-60/month
- **Savings**: ~80% cost reduction

---

## AWS Services Setup

### Prerequisites
- AWS Account with IAM user access to DynamoDB and S3
- AWS CLI installed (or use AWS Console UI)
- Node.js 18+ and npm installed
- Access credentials for AWS services

### 1. AWS Configuration

Since you have DynamoDB and S3 permissions through your IAM user, we'll use those directly.

#### 1.1 Get Your AWS Credentials
You should have:
- AWS Access Key ID
- AWS Secret Access Key
- Region (typically us-east-1)

#### 1.2 Test Your Access
```bash
# If using CLI, configure it:
aws configure

# Test DynamoDB access:
aws dynamodb list-tables

# Test S3 access:
aws s3 ls
```

Alternatively, use the AWS Console for all setup steps.

### 2. DynamoDB Tables Setup (Only 3 Tables with JWT)

**Note**: With JWT sessions, we only need 3 tables (no sessions table needed).

#### Option A: Using AWS Console (Easier)

**Table 1: Users Table**
1. Go to DynamoDB Console: https://console.aws.amazon.com/dynamodbv2
2. Click "Create table"
3. Settings:
   - Table name: `repo-dashboard-users`
   - Partition key: `id` (String)
   - Table settings: Customize → On-demand
4. After creation, add Global Secondary Index:
   - Click on table → Indexes tab → Create index
   - Partition key: `email` (String)
   - Index name: `email-index`
   - Create

**Table 2: Accounts Table** (for OAuth)
- Table name: `repo-dashboard-accounts`
- Partition key: `id` (String)
- Settings: On-demand

**Table 3: Whitelist Table**
- Table name: `repo-dashboard-whitelist`
- Partition key: `email` (String)
- Settings: On-demand

#### Option B: Using AWS CLI

```bash
# Users table
aws dynamodb create-table \
  --table-name repo-dashboard-users \
  --attribute-definitions \
    AttributeName=id,AttributeType=S \
    AttributeName=email,AttributeType=S \
  --key-schema \
    AttributeName=id,KeyType=HASH \
  --billing-mode PAY_PER_REQUEST \
  --global-secondary-indexes '[{
    "IndexName": "email-index",
    "Keys": [{"AttributeName": "email", "KeyType": "HASH"}],
    "Projection": {"ProjectionType": "ALL"},
    "ProvisionedThroughput": {"ReadCapacityUnits": 1, "WriteCapacityUnits": 1}
  }]'

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

#### 2.3 Add Initial Authorized Emails to Whitelist

**Important**: Add your email to the whitelist or you won't be able to login!

**Using Console:**
1. Go to DynamoDB → Tables → repo-dashboard-whitelist
2. Click "Explore table items" → "Create item"
3. Add:
   - email (String): your-email@example.com
   - isActive (Boolean): true
   - role (String): admin
   - addedAt (Number): Current timestamp
   - addedBy (String): system

**Using CLI:**
```bash
aws dynamodb put-item \
  --table-name repo-dashboard-whitelist \
  --item '{
    "email": {"S": "your-email@example.com"},
    "isActive": {"BOOL": true},
    "role": {"S": "admin"},
    "addedAt": {"N": "'$(date +%s)000'"},
    "addedBy": {"S": "system"}
  }'
```

### 3. S3 Bucket Setup (Using Console or CLI)

#### Option A: Using AWS Console

1. Go to S3 Console: https://console.aws.amazon.com/s3
2. Click "Create bucket"
3. Settings:
   - Bucket name: `repo-dashboard-files-[your-account-id]`
   - Region: us-east-1
   - Block all public access: ✓ (keep checked)
   - Versioning: Enable
   - Default encryption: Enable (SSE-S3)
4. Create bucket

**Configure CORS:**
1. Go to your bucket → Permissions tab
2. Scroll to CORS section → Edit
3. Add:
```json
[
  {
    "AllowedHeaders": ["*"],
    "AllowedMethods": ["GET", "PUT", "POST", "DELETE"],
    "AllowedOrigins": ["http://localhost:3000"],
    "ExposeHeaders": ["ETag"],
    "MaxAgeSeconds": 3000
  }
]
```

#### Option B: Using AWS CLI

```bash
# Get your account ID
ACCOUNT_ID=$(aws sts get-caller-identity --query Account --output text)

# Create bucket
aws s3api create-bucket \
  --bucket repo-dashboard-files-${ACCOUNT_ID} \
  --region us-east-1 \
  --acl private

# Enable versioning
aws s3api put-bucket-versioning \
  --bucket repo-dashboard-files-${ACCOUNT_ID} \
  --versioning-configuration Status=Enabled

# Add CORS configuration
aws s3api put-bucket-cors \
  --bucket repo-dashboard-files-${ACCOUNT_ID} \
  --cors-configuration '{
    "CORSRules": [{
      "AllowedHeaders": ["*"],
      "AllowedMethods": ["GET", "PUT", "POST", "DELETE"],
      "AllowedOrigins": ["http://localhost:3000"],
      "ExposeHeaders": ["ETag"],
      "MaxAgeSeconds": 3000
    }]
  }'
```

#### 3.1 Create Folders for Organization

**Using Console:**
1. Go to your bucket
2. Click "Create folder"
3. Name: `mappings`
4. Create

**Using CLI:**
```bash
# Create mappings folder (conceptual - S3 doesn't have real folders)
aws s3api put-object \
  --bucket repo-dashboard-files-${ACCOUNT_ID} \
  --key mappings/

# Upload existing files if you have them
aws s3 cp github-mapping.csv s3://repo-dashboard-files-${ACCOUNT_ID}/mappings/
aws s3 cp github-mapping.json s3://repo-dashboard-files-${ACCOUNT_ID}/mappings/
```

### 4. Google OAuth Setup (Optional)

If you want to allow "Sign in with Google":

1. **Go to Google Cloud Console**: https://console.cloud.google.com
2. **Create a new project** or select existing
3. **Enable Google+ API**
4. **Create OAuth 2.0 Credentials**:
   - Go to APIs & Services → Credentials
   - Create Credentials → OAuth 2.0 Client ID
   - Application type: Web application
   - Name: Repo Dashboard
   - Authorized JavaScript origins:
     - `http://localhost:3000`
     - `https://yourdomain.com` (for production)
   - Authorized redirect URIs:
     - `http://localhost:3000/api/auth/callback/google`
     - `https://yourdomain.com/api/auth/callback/google`
5. **Save the Client ID and Client Secret**

---


## Application Implementation

### 1. Project Structure

```
repo-activity-dashboard/
├── src/
│   ├── app/
│   │   ├── (protected)/          # Protected routes
│   │   │   ├── layout.tsx        # Auth check wrapper
│   │   │   ├── page.tsx          # Main dashboard (moved)
│   │   │   ├── contributors/     # Contributors page (moved)
│   │   │   ├── companies/        # Companies page (moved)
│   │   │   └── admin/            # Admin panel
│   │   │       ├── page.tsx      # Admin dashboard
│   │   │       ├── whitelist/    # Whitelist management
│   │   │       └── files/        # File management
│   │   ├── auth/
│   │   │   ├── login/
│   │   │   │   └── page.tsx      # Login page
│   │   │   ├── register/
│   │   │   │   └── page.tsx      # Registration page
│   │   │   └── error/
│   │   │       └── page.tsx      # Auth error page
│   │   ├── api/
│   │   │   ├── auth/
│   │   │   │   ├── [...nextauth]/
│   │   │   │   │   └── route.ts  # NextAuth API
│   │   │   │   └── register/
│   │   │   │       └── route.ts  # Registration API
│   │   │   └── admin/
│   │   │       ├── files/
│   │   │       │   ├── route.ts      # List files
│   │   │       │   └── upload/
│   │   │       │       └── route.ts  # Upload file
│   │   │       └── whitelist/
│   │   │           └── route.ts      # Manage whitelist
│   │   └── layout.tsx             # Root layout
│   ├── components/
│   │   ├── auth/
│   │   │   ├── login-form.tsx    # Login form component
│   │   │   └── register-form.tsx # Registration form
│   │   ├── layout/
│   │   │   ├── toolbar.tsx       # Updated with auth
│   │   │   └── user-menu.tsx     # User profile menu
│   │   └── admin/
│   │       ├── whitelist-manager.tsx
│   │       └── file-manager.tsx
│   ├── lib/
│   │   ├── auth/
│   │   │   ├── auth.ts           # NextAuth configuration
│   │   │   ├── dynamodb-adapter.ts # DynamoDB adapter
│   │   │   ├── whitelist.ts      # Whitelist utilities
│   │   │   ├── passwords.ts      # Password hashing
│   │   │   └── users.ts          # User management
│   │   └── aws/
│   │       ├── clients.ts        # AWS service clients
│   │       ├── dynamodb.ts       # DynamoDB utilities
│   │       └── s3.ts             # S3 utilities
│   ├── middleware.ts             # Auth middleware
│   └── types/
│       └── next-auth.d.ts       # TypeScript augmentation
├── .env.local                    # Environment variables
└── package.json                  # Dependencies
```

### 2. Dependencies Installation

```bash
npm install next-auth@beta @auth/dynamodb-adapter \
  @aws-sdk/client-dynamodb @aws-sdk/lib-dynamodb \
  @aws-sdk/client-s3 @aws-sdk/s3-request-presigner \
  bcryptjs uuid \
  @types/bcryptjs @types/uuid
```

### 3. Environment Variables

Create `.env.local`:
```env
# Application
NODE_ENV=development
NEXTAUTH_URL=http://localhost:3000
NEXTAUTH_SECRET=generate-with-openssl-rand-base64-32

# AWS Configuration
AWS_REGION=us-east-1
AWS_ACCESS_KEY_ID=your-access-key
AWS_SECRET_ACCESS_KEY=your-secret-key

# Google OAuth (optional)
GOOGLE_CLIENT_ID=your-google-client-id.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=your-google-client-secret

# DynamoDB Tables (only 3 with JWT sessions)
DYNAMODB_USERS_TABLE=repo-dashboard-users
DYNAMODB_ACCOUNTS_TABLE=repo-dashboard-accounts
DYNAMODB_WHITELIST_TABLE=repo-dashboard-whitelist

# S3
S3_BUCKET_NAME=repo-dashboard-files-xxx
```

Generate NextAuth secret:
```bash
openssl rand -base64 32
```

### 4. Key Implementation Files

The detailed implementation files are provided in the Quick Setup guide. Key files to implement:

1. **AWS Clients** (`src/lib/aws/clients.ts`)
2. **DynamoDB Adapter** (`src/lib/auth/dynamodb-adapter.ts`)
3. **NextAuth Configuration** (`src/lib/auth/auth.ts`)
4. **Whitelist Utilities** (`src/lib/auth/whitelist.ts`)
5. **Password Management** (`src/lib/auth/passwords.ts`)
6. **User Management** (`src/lib/auth/users.ts`)
7. **Login Page** (`src/app/auth/login/page.tsx`)
8. **Registration Page** (`src/app/auth/register/page.tsx`)
9. **Protected Layout** (`src/app/(protected)/layout.tsx`)
10. **API Routes** (`src/app/api/auth/[...nextauth]/route.ts`)
11. **Admin Components** (`src/components/admin/*`)

---

## Deployment Guide

### 1. AWS Amplify Deployment

#### 1.1 Initialize Amplify
```bash
# Install Amplify CLI
npm install -g @aws-amplify/cli

# Configure Amplify
amplify configure

# Initialize project
amplify init
# ? Enter a name for the project: repo-activity-dashboard
# ? Enter a name for the environment: prod
# ? Choose your default editor: Visual Studio Code
# ? Choose the type of app: javascript
# ? What javascript framework: react
# ? Source Directory Path: src
# ? Distribution Directory Path: .next
# ? Build Command: npm run build
# ? Start Command: npm start
```

#### 1.2 Add Hosting
```bash
amplify add hosting
# ? Select the plugin module to execute: Hosting with Amplify Console
# ? Choose a type: Manual deployment
```

#### 1.3 Create amplify.yml
```yaml
version: 1
frontend:
  phases:
    preBuild:
      commands:
        - npm ci
    build:
      commands:
        - npm run build
  artifacts:
    baseDirectory: .next
    files:
      - '**/*'
  cache:
    paths:
      - node_modules/**/*
      - .next/cache/**/*
```

#### 1.4 Deploy
```bash
amplify publish
```

### 2. Environment Variables in Amplify

1. Go to AWS Amplify Console
2. Select your app
3. Go to App settings → Environment variables
4. Add all variables from `.env.local`
5. Save and redeploy

### 3. Custom Domain Setup (Optional)

```bash
# In Amplify Console
1. Go to App settings → Domain management
2. Add domain
3. Follow DNS configuration instructions
4. Wait for SSL certificate provisioning (15-30 minutes)
```

---

## Monitoring & Maintenance

### 1. CloudWatch Dashboard

Create a dashboard to monitor:
- Cognito sign-ins and failures
- DynamoDB read/write capacity
- Lambda invocations and errors
- S3 bucket size and requests

```bash
# Create dashboard
aws cloudwatch put-dashboard \
  --dashboard-name RepoActivityDashboard \
  --dashboard-body '{
    "widgets": [
      {
        "type": "metric",
        "properties": {
          "metrics": [
            ["AWS/Cognito", "SignInSuccesses", {"stat": "Sum"}],
            [".", "SignInFailures", {"stat": "Sum"}]
          ],
          "period": 300,
          "stat": "Average",
          "region": "us-east-1",
          "title": "Authentication Metrics"
        }
      },
      {
        "type": "metric",
        "properties": {
          "metrics": [
            ["AWS/DynamoDB", "ConsumedReadCapacityUnits", {"stat": "Sum"}],
            [".", "ConsumedWriteCapacityUnits", {"stat": "Sum"}]
          ],
          "period": 300,
          "stat": "Average",
          "region": "us-east-1",
          "title": "DynamoDB Usage"
        }
      }
    ]
  }'
```

### 2. Cost Monitoring

Set up billing alerts:
```bash
# Create SNS topic for alerts
aws sns create-topic --name repo-dashboard-billing-alerts

# Subscribe email
aws sns subscribe \
  --topic-arn arn:aws:sns:us-east-1:xxx:repo-dashboard-billing-alerts \
  --protocol email \
  --notification-endpoint your-email@example.com

# Create billing alarm
aws cloudwatch put-metric-alarm \
  --alarm-name repo-dashboard-monthly-cost \
  --alarm-description "Alert when monthly cost exceeds $20" \
  --metric-name EstimatedCharges \
  --namespace AWS/Billing \
  --statistic Maximum \
  --period 86400 \
  --threshold 20 \
  --comparison-operator GreaterThanThreshold \
  --dimensions Name=Currency,Value=USD \
  --evaluation-periods 1 \
  --alarm-actions arn:aws:sns:us-east-1:xxx:repo-dashboard-billing-alerts
```

### 3. Backup Strategy

#### DynamoDB Backups
```bash
# Enable point-in-time recovery
aws dynamodb update-continuous-backups \
  --table-name repo-dashboard-users \
  --point-in-time-recovery-specification PointInTimeRecoveryEnabled=true

# Create on-demand backup
aws dynamodb create-backup \
  --table-name repo-dashboard-users \
  --backup-name repo-dashboard-users-$(date +%Y%m%d)
```

#### S3 Backup
```bash
# Enable versioning (already done)
# Create backup bucket
aws s3 mb s3://repo-dashboard-backup-xxx

# Sync files
aws s3 sync s3://repo-dashboard-files-xxx s3://repo-dashboard-backup-xxx --delete
```

### 4. Regular Maintenance Tasks

#### Weekly
- Review CloudWatch logs for errors
- Check authentication failure rates
- Monitor DynamoDB throttling

#### Monthly
- Review AWS bill
- Analyze user activity patterns
- Clean up old audit logs
- Update authorized email list

#### Quarterly
- Security audit
- Dependency updates
- Performance optimization
- Cost optimization review

---

## Troubleshooting

### Common Issues and Solutions

#### 1. User Can't Login

**Issue:** "Email not authorized" error
**Solutions:**
- Verify email is in `authorized_emails` table
- Check `isActive` field is true
- Ensure email case matches (should be lowercase)
- Check Lambda function logs in CloudWatch

```bash
# Check whitelist
aws dynamodb get-item \
  --table-name repo-dashboard-authorized-emails \
  --key '{"email": {"S": "user@example.com"}}'

# Check Lambda logs
aws logs tail /aws/lambda/repo-dashboard-pre-auth --follow
```

#### 2. Google OAuth Not Working

**Issue:** Redirect mismatch or 400 error
**Solutions:**
- Verify redirect URIs in Google Console match Cognito
- Check Cognito app client settings
- Ensure domain is correctly configured

```bash
# Get Cognito domain
aws cognito-idp describe-user-pool-domain \
  --domain repo-dashboard-pool
```

#### 3. Session Expiring Too Quickly

**Issue:** Users logged out frequently
**Solutions:**
- Check token validity in Cognito app client
- Verify NextAuth session configuration
- Check DynamoDB session TTL

```javascript
// In auth.ts
session: {
  strategy: 'database',
  maxAge: 30 * 24 * 60 * 60, // 30 days
  updateAge: 24 * 60 * 60, // 24 hours
}
```

#### 4. File Upload Failing

**Issue:** S3 upload errors
**Solutions:**
- Check CORS configuration on S3 bucket
- Verify pre-signed URL generation
- Check file size limits
- Verify IAM permissions

```bash
# Check CORS
aws s3api get-bucket-cors --bucket repo-dashboard-files-xxx

# Test pre-signed URL
curl -X PUT -T testfile.txt "presigned-url-here"
```

#### 5. DynamoDB Throttling

**Issue:** ProvisionedThroughputExceededException
**Solutions:**
- Switch to on-demand billing
- Increase provisioned capacity
- Implement exponential backoff

```bash
# Switch to on-demand
aws dynamodb update-table \
  --table-name repo-dashboard-users \
  --billing-mode PAY_PER_REQUEST
```

#### 6. High AWS Costs

**Issue:** Bill exceeding $15/month
**Solutions:**
- Review CloudWatch logs retention (set to 7 days)
- Check S3 lifecycle policies
- Analyze DynamoDB usage patterns
- Review Lambda invocation counts

```bash
# Get cost breakdown
aws ce get-cost-and-usage \
  --time-period Start=2024-01-01,End=2024-01-31 \
  --granularity MONTHLY \
  --metrics "UnblendedCost" \
  --group-by Type=DIMENSION,Key=SERVICE
```

### Debug Commands

```bash
# Test Cognito authentication
aws cognito-idp initiate-auth \
  --client-id YOUR_CLIENT_ID \
  --auth-flow USER_PASSWORD_AUTH \
  --auth-parameters USERNAME=test@example.com,PASSWORD=TestPass123

# List DynamoDB items
aws dynamodb scan --table-name repo-dashboard-users

# Check Lambda function
aws lambda invoke \
  --function-name repo-dashboard-pre-auth \
  --payload '{"request":{"userAttributes":{"email":"test@example.com"}}}' \
  response.json

# Monitor real-time logs
aws logs tail /aws/lambda/repo-dashboard-pre-auth --follow
```

---

## Security Best Practices

### 1. AWS Security

- Enable MFA on AWS root account
- Use IAM roles instead of access keys where possible
- Regularly rotate access keys
- Enable CloudTrail for audit logging
- Use AWS Secrets Manager for production

### 2. Application Security

- Always use HTTPS in production
- Implement rate limiting
- Validate all user inputs
- Use prepared statements for database queries
- Keep dependencies updated

### 3. Data Protection

- Enable encryption at rest for DynamoDB
- Use S3 server-side encryption
- Implement field-level encryption for sensitive data
- Regular backups
- GDPR compliance considerations

---

## Migration Checklist

### Pre-Migration
- [ ] AWS account created and configured
- [ ] Cognito User Pool created
- [ ] DynamoDB tables created
- [ ] S3 bucket configured
- [ ] Lambda functions deployed
- [ ] Whitelist populated
- [ ] Environment variables set

### Implementation
- [ ] Dependencies installed
- [ ] DynamoDB adapter created
- [ ] NextAuth configured
- [ ] Login/Register pages created
- [ ] Middleware implemented
- [ ] Protected routes configured
- [ ] User menu added
- [ ] Admin panel created

### Testing
- [ ] Local authentication working
- [ ] Google OAuth functional
- [ ] Username/password registration
- [ ] Whitelist enforcement
- [ ] File upload/download
- [ ] Admin functions
- [ ] Session persistence

### Deployment
- [ ] Amplify initialized
- [ ] Environment variables configured
- [ ] Application deployed
- [ ] Custom domain configured (optional)
- [ ] SSL certificate active
- [ ] Monitoring enabled

### Post-Deployment
- [ ] Test production authentication
- [ ] Verify all routes protected
- [ ] Check CloudWatch logs
- [ ] Monitor costs
- [ ] Document admin procedures
- [ ] Train team members

---

## Contact & Support

### AWS Support Resources
- AWS Documentation: https://docs.aws.amazon.com
- AWS Forums: https://forums.aws.amazon.com
- AWS Support (if you have a support plan)

### Common AWS Service Limits
- Cognito: 50,000 MAU free tier
- DynamoDB: 25 GB free tier storage
- Lambda: 1M requests/month free
- S3: 5 GB storage free tier
- CloudWatch: 5 GB logs free tier

### Estimated Timeline
- Week 1: AWS setup and configuration
- Week 2: Application implementation
- Week 3: Testing and deployment
- Week 4: Monitoring and optimization

---

## Appendix

### A. Cost Calculation Details

```
DynamoDB Costs (On-Demand):
- Reads: 1000/day * 30 days = 30,000 reads/month
  Cost: 30,000 / 1,000,000 * $0.25 = $0.0075
- Writes: 100/day * 30 days = 3,000 writes/month
  Cost: 3,000 / 1,000,000 * $1.25 = $0.00375
- Storage: ~100MB = $0.025
- Total DynamoDB: ~$0.04/month

S3 Costs:
- Storage: 100MB = $0.0023
- Requests: 1000 GET = $0.0004
- Transfer: 1GB = $0.09
- Total S3: ~$0.10/month

Lambda Costs:
- Invocations: 1000/month = FREE (under 1M)
- Duration: 1000 * 100ms = FREE (under 400k GB-sec)
- Total Lambda: $0

Amplify Hosting:
- Build minutes: 100 min = $0.01/min = $1
- Hosting: 5GB transfer = $0.15/GB = $0.75
- Total Amplify: ~$5-10/month

Total Monthly: $5-15/month
```

### B. Useful AWS CLI Aliases

Add to `~/.aws/cli/alias`:
```ini
[toplevel]
list-tables = dynamodb list-tables
scan-users = dynamodb scan --table-name repo-dashboard-users
scan-whitelist = dynamodb scan --table-name repo-dashboard-authorized-emails
logs-auth = logs tail /aws/lambda/repo-dashboard-pre-auth --follow
s3-files = s3 ls s3://repo-dashboard-files-xxx/mappings/
```

### C. Sample Data

Sample whitelist entry:
```json
{
  "email": "john.doe@example.com",
  "role": "admin",
  "company": "Example Corp",
  "isActive": true,
  "addedBy": "admin@example.com",
  "addedAt": 1703001600000,
  "notes": "Engineering team lead"
}
```

Sample user record:
```json
{
  "userId": "550e8400-e29b-41d4-a716-446655440000",
  "email": "john.doe@example.com",
  "name": "John Doe",
  "image": "https://avatar.example.com/john.jpg",
  "emailVerified": "2024-01-01T00:00:00.000Z",
  "role": "admin",
  "company": "Example Corp",
  "createdAt": "2024-01-01T00:00:00.000Z",
  "updatedAt": "2024-01-15T00:00:00.000Z",
  "lastLogin": "2024-01-20T00:00:00.000Z"
}
```

---

*Last Updated: January 2025*
*Version: 1.0.0*