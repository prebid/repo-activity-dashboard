# AWS Amplify Deployment Guide for Repo Activity Dashboard

## Table of Contents
1. [Pre-Deployment Checklist](#pre-deployment-checklist)
2. [AWS Amplify Setup](#aws-amplify-setup)
3. [Environment Configuration](#environment-configuration)
4. [Build Configuration](#build-configuration)
5. [Custom Domain Setup](#custom-domain-setup)
6. [Post-Deployment Configuration](#post-deployment-configuration)
7. [Monitoring & Maintenance](#monitoring--maintenance)
8. [Troubleshooting Guide](#troubleshooting-guide)
9. [Cost Optimization](#cost-optimization)

---

## Pre-Deployment Checklist

### Required Prerequisites
- [x] AWS Account with appropriate permissions
- [x] GitHub repository (prebid/repo-activity-dashboard)
- [x] DynamoDB tables created (users, accounts, whitelist)
- [x] S3 bucket configured (if using file storage)
- [ ] Production environment variables ready
- [ ] Domain name (optional but recommended)

### Code Preparation
```bash
# 1. Ensure production build works locally
npm run build

# 2. Test production build
npm run start

# 3. Verify all environment variables are documented
cat .env.example  # Create this if it doesn't exist

# 4. Ensure .gitignore excludes sensitive files
cat .gitignore | grep -E "\.env|\.next|node_modules"
```

### Create .env.production Template
```bash
# Create .env.example for reference (DO NOT commit actual values)
cat > .env.example << 'EOF'
# GitHub API Configuration
GITHUB_TOKEN=your_github_pat_here

# NextAuth Configuration
NEXTAUTH_URL=https://your-domain.com
NEXTAUTH_SECRET=generate_with_openssl_rand_base64_32

# AWS Configuration
AWS_REGION=us-east-2
AWS_ACCESS_KEY_ID=your_access_key_here
AWS_SECRET_ACCESS_KEY=your_secret_key_here

# DynamoDB Tables
DYNAMODB_USERS_TABLE=repo-dashboard-users
DYNAMODB_ACCOUNTS_TABLE=repo-dashboard-accounts
DYNAMODB_WHITELIST_TABLE=repo-dashboard-whitelist

# S3
S3_BUCKET_NAME=repo-dashboard-files-891377123989

# Google OAuth (Optional)
GOOGLE_CLIENT_ID=
GOOGLE_CLIENT_SECRET=

# Application
NODE_ENV=production
EOF
```

---

## AWS Amplify Setup

### Step 1: Navigate to AWS Amplify Console

1. Go to [AWS Amplify Console](https://console.aws.amazon.com/amplify)
2. Ensure you're in the correct region (us-east-2)
3. Click **"New app"** → **"Host web app"**

### Step 2: Connect Your Repository

1. **Choose your Git provider**: GitHub
2. **Authorize AWS Amplify**: Click "Authorize" and grant access
3. **Select repository**: `prebid/repo-activity-dashboard`
4. **Select branch**: `main` (or your production branch)

### Step 3: Configure Build Settings

#### Build Specification (amplify.yml)
Create this file in your repository root BEFORE deployment:

```yaml
version: 1
applications:
  - frontend:
      phases:
        preBuild:
          commands:
            # Install dependencies
            - npm ci --cache .npm --prefer-offline

            # Create production env file from Amplify environment variables
            - |
              cat > .env.production << EOF
              GITHUB_TOKEN=$GITHUB_TOKEN
              NEXTAUTH_URL=$NEXTAUTH_URL
              NEXTAUTH_SECRET=$NEXTAUTH_SECRET
              AWS_REGION=$AWS_REGION
              AWS_ACCESS_KEY_ID=$AWS_ACCESS_KEY_ID
              AWS_SECRET_ACCESS_KEY=$AWS_SECRET_ACCESS_KEY
              DYNAMODB_USERS_TABLE=$DYNAMODB_USERS_TABLE
              DYNAMODB_ACCOUNTS_TABLE=$DYNAMODB_ACCOUNTS_TABLE
              DYNAMODB_WHITELIST_TABLE=$DYNAMODB_WHITELIST_TABLE
              S3_BUCKET_NAME=$S3_BUCKET_NAME
              GOOGLE_CLIENT_ID=$GOOGLE_CLIENT_ID
              GOOGLE_CLIENT_SECRET=$GOOGLE_CLIENT_SECRET
              NODE_ENV=production
              EOF

            # Verify critical environment variables
            - |
              if [ -z "$NEXTAUTH_SECRET" ]; then
                echo "ERROR: NEXTAUTH_SECRET is not set!"
                exit 1
              fi

        build:
          commands:
            # Build Next.js application
            - npm run build

            # Show build output size for monitoring
            - du -sh .next/

      artifacts:
        baseDirectory: .next
        files:
          - '**/*'

      cache:
        paths:
          - '.npm/**/*'
          - 'node_modules/**/*'

    appRoot: .

    # Next.js specific settings
    platform: WEB_COMPUTE
    framework: Next.js - SSR
```

### Step 4: Configure Build Settings in Console

1. **App name**: `repo-activity-dashboard`
2. **Environment name**: `production`
3. **Platform**: Select **"Web Compute"** (for SSR support)
4. **Build and test settings**:
   - Build command: `npm run build`
   - Build output directory: `.next`

#### Advanced Settings:
```yaml
Build image: Amazon Linux 2023 (latest)
Node.js version: 20.x (or your version)
Enable SSR logging: Yes
Build timeout: 30 minutes
```

---

## Environment Configuration

### Step 1: Add Environment Variables in Amplify Console

1. In Amplify Console, go to **App settings** → **Environment variables**
2. Click **"Manage variables"**
3. Add each variable one by one:

```bash
# Critical Variables (MUST be set)
NEXTAUTH_URL=https://your-amplify-url.amplifyapp.com  # Update after deployment
NEXTAUTH_SECRET=<generate-with-openssl>               # openssl rand -base64 32

# AWS Credentials (your existing values)
AWS_REGION=us-east-2
AWS_ACCESS_KEY_ID=AKIA47CRXQKKQIMTNM44
AWS_SECRET_ACCESS_KEY=<your-secret-key>

# DynamoDB Tables
DYNAMODB_USERS_TABLE=repo-dashboard-users
DYNAMODB_ACCOUNTS_TABLE=repo-dashboard-accounts
DYNAMODB_WHITELIST_TABLE=repo-dashboard-whitelist

# S3
S3_BUCKET_NAME=repo-dashboard-files-891377123989

# GitHub
GITHUB_TOKEN=<your-github-pat>

# Optional
GOOGLE_CLIENT_ID=
GOOGLE_CLIENT_SECRET=
```

### Step 2: Configure Branch-Specific Variables (Optional)

For staging environments:
```bash
# Click "Actions" → "Add variable override"
# Select branch: staging
# Override specific variables like:
NEXTAUTH_URL=https://staging.your-domain.com
DYNAMODB_USERS_TABLE=repo-dashboard-users-staging
```

---

## Build Configuration

### Next.js Specific Configuration

Create/update `next.config.js`:

```javascript
/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'standalone',  // Required for Amplify

  images: {
    domains: ['avatars.githubusercontent.com'],  // If using GitHub avatars
    unoptimized: true,  // Required for static export if not using SSR
  },

  // Environment variables that should be available client-side
  env: {
    NEXT_PUBLIC_APP_URL: process.env.NEXTAUTH_URL || 'http://localhost:3000',
  },

  // Amplify specific headers
  async headers() {
    return [
      {
        source: '/:path*',
        headers: [
          {
            key: 'X-Frame-Options',
            value: 'DENY',
          },
          {
            key: 'X-Content-Type-Options',
            value: 'nosniff',
          },
          {
            key: 'X-XSS-Protection',
            value: '1; mode=block',
          },
        ],
      },
    ];
  },

  // Redirects for auth routes
  async redirects() {
    return [
      {
        source: '/signin',
        destination: '/auth/login',
        permanent: true,
      },
    ];
  },
};

module.exports = nextConfig;
```

### Package.json Scripts Update

```json
{
  "scripts": {
    "dev": "next dev --turbo",
    "build": "next build",
    "start": "next start",
    "build:amplify": "next build && cp -r public .next/standalone/public && cp -r .next/static .next/standalone/.next/static",
    "start:amplify": "node .next/standalone/server.js"
  }
}
```

---

## Custom Domain Setup

### Step 1: Domain Configuration

1. In Amplify Console, go to **Domain management**
2. Click **"Add domain"**
3. Choose your domain provider:
   - **Route 53**: Automatic configuration
   - **Other providers**: Manual DNS configuration

### Step 2: SSL Certificate

Amplify automatically provisions SSL certificates. For custom domains:

1. **Automatic validation** (Route 53): No action needed
2. **Manual validation** (other providers):
   ```
   Add CNAME records:
   _abc123.yourdomain.com → _validation.aws.com.
   ```

### Step 3: Configure Subdomains

```
www.yourdomain.com → Redirect to apex domain
app.yourdomain.com → Main application
staging.yourdomain.com → Staging branch (optional)
```

### Step 4: Update NextAuth URL

After domain is configured:
1. Go to **Environment variables**
2. Update `NEXTAUTH_URL` to `https://yourdomain.com`
3. Trigger a new deployment

---

## Post-Deployment Configuration

### Step 1: Verify Deployment

```bash
# Test authentication
curl https://your-app.amplifyapp.com/api/auth/providers

# Test API routes
curl https://your-app.amplifyapp.com/api/repos

# Check NextAuth configuration
curl https://your-app.amplifyapp.com/api/auth/session
```

### Step 2: Create First Admin User

1. Navigate to `https://your-app.amplifyapp.com/auth/setup`
2. Enter admin email (must be in whitelist)
3. Set password
4. Verify login works

### Step 3: Configure Monitoring

#### CloudWatch Integration (Automatic)
Amplify automatically sends logs to CloudWatch:
- **Access logs**: `/aws/amplify/your-app-id`
- **Build logs**: `/aws/amplify/your-app-id/build`
- **SSR function logs**: `/aws/lambda/your-function-name`

#### Set Up Alarms
```bash
aws cloudwatch put-metric-alarm \
  --alarm-name "AmplifyHighErrorRate" \
  --alarm-description "Alert when error rate is high" \
  --metric-name 4XXError \
  --namespace AWS/AmplifyHosting \
  --statistic Sum \
  --period 300 \
  --threshold 10 \
  --comparison-operator GreaterThanThreshold \
  --evaluation-periods 2
```

### Step 4: Setup Webhooks for Auto-Deploy

1. Go to **Build settings** → **Incoming webhooks**
2. Create webhook for GitHub
3. Configure GitHub repository:
   ```
   Settings → Webhooks → Add webhook
   URL: https://webhooks.amplify.region.amazonaws.com/...
   Events: Push, Pull Request
   ```

---

## Monitoring & Maintenance

### Performance Monitoring

#### Key Metrics to Track
- **Build time**: Should be < 10 minutes
- **Cold start time**: Should be < 3 seconds
- **API response time**: Should be < 500ms
- **Error rate**: Should be < 1%

#### CloudWatch Dashboard Setup
Create a custom dashboard with these metrics:
```json
{
  "widgets": [
    {
      "type": "metric",
      "properties": {
        "metrics": [
          ["AWS/AmplifyHosting", "4XXError", {"stat": "Sum"}],
          [".", "5XXError", {"stat": "Sum"}],
          [".", "BytesDownloaded", {"stat": "Sum"}],
          [".", "Requests", {"stat": "Sum"}]
        ],
        "period": 300,
        "stat": "Average",
        "region": "us-east-2",
        "title": "Amplify Metrics"
      }
    }
  ]
}
```

### Maintenance Tasks

#### Weekly
- [ ] Review CloudWatch logs for errors
- [ ] Check build times and optimize if needed
- [ ] Monitor bandwidth usage
- [ ] Review user authentication logs

#### Monthly
- [ ] Update dependencies: `npm update`
- [ ] Review and rotate API keys
- [ ] Analyze cost reports
- [ ] Performance audit with Lighthouse

#### Quarterly
- [ ] Security audit
- [ ] Disaster recovery test
- [ ] Review and update documentation
- [ ] Capacity planning review

---

## Troubleshooting Guide

### Common Issues and Solutions

#### 1. Build Failures

**Error**: `Module not found`
```bash
# Solution: Clear cache and rebuild
amplify push --clear-cache
```

**Error**: `Out of memory`
```yaml
# Solution: Increase build memory in amplify.yml
build:
  commands:
    - node --max-old-space-size=4096 node_modules/.bin/next build
```

#### 2. Environment Variable Issues

**Error**: `NEXTAUTH_URL mismatch`
```bash
# Solution: Ensure NEXTAUTH_URL matches your Amplify URL
# In Amplify Console:
# 1. Go to Environment variables
# 2. Update NEXTAUTH_URL to match your domain
# 3. Redeploy
```

#### 3. SSR Function Errors

**Error**: `Function timeout`
```javascript
// Solution: Optimize API routes
// Add caching to expensive operations
import { unstable_cache } from 'next/cache';

const getCachedData = unstable_cache(
  async () => fetchExpensiveData(),
  ['cache-key'],
  { revalidate: 3600 }
);
```

#### 4. Database Connection Issues

**Error**: `ResourceNotFoundException`
```javascript
// Solution: Verify table names and region
console.log('Table:', process.env.DYNAMODB_USERS_TABLE);
console.log('Region:', process.env.AWS_REGION);
```

#### 5. Authentication Failures

**Error**: `Invalid callback URL`
```javascript
// Solution: Add Amplify URL to authorized callbacks
// Update NEXTAUTH_URL and add to NextAuth config:
callbacks: {
  async redirect({ url, baseUrl }) {
    const allowedHosts = [
      'localhost:3000',
      'your-app.amplifyapp.com',
      'yourdomain.com'
    ];

    const urlObj = new URL(url, baseUrl);
    if (allowedHosts.includes(urlObj.host)) {
      return url;
    }
    return baseUrl;
  }
}
```

### Debug Mode

Enable verbose logging for troubleshooting:

```javascript
// next.config.js
module.exports = {
  ...nextConfig,
  env: {
    ...nextConfig.env,
    DEBUG: process.env.NODE_ENV === 'production' ? '' : '*',
    NEXTAUTH_DEBUG: process.env.NODE_ENV === 'production' ? '' : 'true',
  },
};
```

---

## Cost Optimization

### Estimated Monthly Costs

```
Amplify Hosting:
- Build minutes: 1000 min/month free, then $0.01/min
- Hosting: $0.15/GB served
- Request: $0.15/million requests

Typical costs for your app:
- Small traffic (1000 users/month): ~$5-10
- Medium traffic (10,000 users/month): ~$15-30
- Large traffic (100,000 users/month): ~$50-100

Additional AWS Services:
- DynamoDB: ~$2-5/month
- S3: ~$1-3/month
- CloudWatch: ~$2-5/month

Total: $10-150/month depending on traffic
```

### Cost Optimization Strategies

1. **Use Caching Aggressively**
```javascript
// Cache static data
export const revalidate = 3600; // Cache for 1 hour

// Use CDN for assets
next.config.js: {
  assetPrefix: process.env.CDN_URL || '',
}
```

2. **Optimize Build Times**
```yaml
# Cache dependencies
cache:
  paths:
    - 'node_modules/**/*'
    - '.next/cache/**/*'
```

3. **Reduce Bundle Size**
```bash
# Analyze bundle
npm run build
npx @next/bundle-analyzer
```

4. **Use Reserved Capacity** (for predictable traffic)
- Purchase Amplify reserved capacity for 1 or 3 years
- Save up to 40% on hosting costs

---

## Security Best Practices

### 1. Environment Variables
```bash
# Never commit secrets
echo ".env*" >> .gitignore

# Use AWS Secrets Manager for sensitive data
aws secretsmanager create-secret \
  --name repo-dashboard/production \
  --secret-string file://.env.production
```

### 2. IAM Permissions
Create a specific IAM user for Amplify with minimal permissions:

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": [
        "dynamodb:Query",
        "dynamodb:Scan",
        "dynamodb:GetItem",
        "dynamodb:PutItem",
        "dynamodb:UpdateItem",
        "dynamodb:DeleteItem"
      ],
      "Resource": [
        "arn:aws:dynamodb:us-east-2:*:table/repo-dashboard-*"
      ]
    },
    {
      "Effect": "Allow",
      "Action": [
        "s3:GetObject",
        "s3:PutObject",
        "s3:DeleteObject"
      ],
      "Resource": [
        "arn:aws:s3:::repo-dashboard-files-*/*"
      ]
    }
  ]
}
```

### 3. API Security
```javascript
// Implement rate limiting
import rateLimit from 'express-rate-limit';

const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // limit each IP to 100 requests
});
```

### 4. Content Security Policy
```javascript
// next.config.js
headers: [
  {
    key: 'Content-Security-Policy',
    value: "default-src 'self'; script-src 'self' 'unsafe-eval' 'unsafe-inline'; style-src 'self' 'unsafe-inline';"
  }
]
```

---

## Deployment Commands Reference

### Quick Deploy
```bash
# Initial deployment
git add amplify.yml
git commit -m "Add Amplify configuration"
git push origin main

# Force redeploy
amplify push --force

# Deploy specific branch
amplify push --branch staging

# Rollback to previous version
amplify rollback
```

### Monitoring Commands
```bash
# View logs
amplify console

# Check status
amplify status

# View metrics
aws cloudwatch get-metric-statistics \
  --namespace AWS/AmplifyHosting \
  --metric-name Requests \
  --dimensions Name=App,Value=your-app-id \
  --start-time 2024-01-01T00:00:00Z \
  --end-time 2024-01-02T00:00:00Z \
  --period 3600 \
  --statistics Sum
```

---

## Final Checklist Before Going Live

- [ ] All environment variables set in Amplify Console
- [ ] NEXTAUTH_URL matches your production URL
- [ ] NEXTAUTH_SECRET is unique and secure
- [ ] Database tables are created and accessible
- [ ] Admin user whitelist entry exists
- [ ] Build completes successfully
- [ ] Authentication flow tested
- [ ] Custom domain configured (optional)
- [ ] SSL certificate active
- [ ] Monitoring alerts configured
- [ ] Backup strategy in place
- [ ] Documentation updated

---

## Support Resources

- [AWS Amplify Documentation](https://docs.amplify.aws/)
- [Next.js on Amplify Guide](https://docs.amplify.aws/guides/hosting/nextjs/)
- [Amplify Discord Community](https://discord.gg/amplify)
- [AWS Support Center](https://console.aws.amazon.com/support/)

---

*Last Updated: September 2024*
*Document Version: 1.0*