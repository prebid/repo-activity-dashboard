# Post-Deployment Cleanup Plan
*Created: 2025-09-23*
*Purpose: Track and execute cleanup of debugging artifacts after AWS Amplify deployment*

## 🔴 CRITICAL SECURITY ISSUES TO FIX

### 1. Remove AWS Credentials from next.config.mjs (HIGHEST PRIORITY)
**File:** `next.config.mjs` (lines 14-15)
**Issue:** AWS credentials are embedded directly in the build
**Security Risk:** Anyone with access to the built JS files can extract your AWS keys
**Fix:** Remove `S3_ACCESS_KEY_ID` and `S3_SECRET_ACCESS_KEY` from the env section
**Keep:** Only keep non-sensitive config like region names and table names

### 2. Remove User Email Logging in Auth Flow
**File:** `src/lib/auth/auth.ts`
**Lines to remove:**
- Line 57: `console.log('[Auth] Authorize called with email:', credentials?.email);`
- Line 69: `console.log('[Auth] Checking whitelist for:', email);`
- Line 78: `console.log('[Auth] Getting user by email');`
- Line 95: `console.log('[Auth] Authentication successful for:', email);`
**Security Risk:** User emails are PII and shouldn't be logged in production

## 🟠 HIGH PRIORITY CLEANUP

### 3. Simplify AWS Clients (Remove Complex Proxy Pattern)
**File:** `src/lib/aws/clients.ts`
**Current:** 65 lines with Proxy pattern and extensive logging
**Target:** ~15 lines of clean initialization
**Remove:**
- All console.log statements (lines 7-13, 22, 25, 38, 48, 61)
- Proxy pattern (lines 35-65)
- getAWSConfig function (lines 5-28)
**Keep:** Simple client initialization with embedded env vars

### 4. Remove Debug Logging from Whitelist
**File:** `src/lib/auth/whitelist.ts`
**Remove lines 7-10, 14:**
```javascript
console.log('[Whitelist] About to import AWS clients');
console.log('[Whitelist] Current env vars:');
console.log('  S3_ACCESS_KEY_ID:', !!process.env.S3_ACCESS_KEY_ID);
console.log('  S3_SECRET_ACCESS_KEY:', !!process.env.S3_SECRET_ACCESS_KEY);
console.log('[Whitelist] docClient imported, sending command');
```

### 5. Clean Health Endpoint
**File:** `src/app/api/health/route.ts`
**Remove:**
- Lines 73-76, 81: Debug logging for env vars
- Lines 71-122: Entire DynamoDB test section (exposes table structure)
**Security Risk:** Exposes internal infrastructure details
**Keep:** Basic health check without DynamoDB testing

## 🟡 MEDIUM PRIORITY

### 6. Remove Other Debug Logging from Auth
**File:** `src/lib/auth/auth.ts`
**Remove remaining console.logs:**
- Line 60: Missing credentials log
- Line 71, 73: Whitelist check logs
- Line 80: User found log
- Line 86, 88: Password verification logs
- Line 103-104: Error logging (keep simplified version)

### 7. Clean Up Misc Debug Logs
**Files with non-critical console.logs to review:**
- `src/app/contributors/page.tsx` - Lines 50, 102, 114, 116
- `src/app/companies/page.tsx` - Line 108
- Remove debug logs but keep any error handling

## 🟢 DOCUMENTATION TO CREATE

### 8. Create DEPLOYMENT.md
Include:
- AWS Amplify setup steps
- Required environment variables (explain they must be in Amplify console, NOT in code)
- DynamoDB setup with exact table schemas
- IAM permissions required
- How to create initial admin user securely
- Common deployment errors and solutions

### 9. Update .env.example
Add clear comments:
```bash
# CRITICAL: These must be set in Amplify Console, NOT embedded in code
S3_ACCESS_KEY_ID=your-key-here
S3_SECRET_ACCESS_KEY=your-secret-here

# These can be in next.config.mjs (non-sensitive)
S3_REGION=us-east-2
AWS_REGION=us-east-2
DYNAMODB_USERS_TABLE=repo-dashboard-users
DYNAMODB_WHITELIST_TABLE=repo-dashboard-whitelist

# NextAuth configuration
NEXTAUTH_URL=https://your-domain.amplifyapp.com
NEXTAUTH_SECRET=generate-with-openssl-rand-base64-32
```

### 10. Update CLAUDE.md
Add section on:
- Security best practices
- Never embed credentials in code
- How to handle environment variables in Amplify
- Document the authentication flow and why dynamic imports are needed

## ⚪ CHANGES TO KEEP (These fixed the issues)

These changes are essential and must NOT be reverted:

1. **Dynamic imports in whitelist.ts and users.ts** ✅
   - Required for AWS credentials to be available at runtime

2. **amplify.yml configuration** ✅
   - Correct build settings for Next.js on Amplify

3. **src/lib/auth/get-secret.ts** ✅
   - Handles NextAuth secret in Amplify environment

4. **Middleware error handling** ✅
   - Prevents auth loops and handles errors gracefully

5. **Region and table names in next.config.mjs** ✅
   - Keep these (but NOT credentials)

## 📊 Cleanup Impact Summary

- **Lines to remove:** ~150 lines of debug code
- **Security issues to fix:** 3 critical, 2 high priority
- **Files to modify:** 5 core files
- **Documentation to create:** 3 files
- **Estimated time:** 30-45 minutes

## ✅ Execution Checklist

- [ ] Backup current working deployment
- [ ] Remove AWS credentials from next.config.mjs
- [ ] Clean auth.ts debug logs (especially emails)
- [ ] Simplify aws/clients.ts
- [ ] Clean whitelist.ts debug logs
- [ ] Clean health endpoint
- [ ] Remove misc debug logs
- [ ] Create DEPLOYMENT.md
- [ ] Update .env.example
- [ ] Update CLAUDE.md
- [ ] Test authentication still works
- [ ] Commit and push changes
- [ ] Verify deployment succeeds
- [ ] Test authentication on deployed site

## 🔒 Security Verification

After cleanup, verify:
1. No credentials in source code
2. No PII in logs
3. Health endpoint doesn't expose infrastructure
4. CloudWatch logs are clean
5. Authentication still works

## Notes

- This cleanup is based on debugging session from 2025-09-23
- AWS Amplify deployment required embedding certain env vars for NextAuth
- The key learning: Amplify doesn't pass custom env vars to NextAuth routes by default
- Solution was to embed non-sensitive config in next.config.mjs, but NOT credentials