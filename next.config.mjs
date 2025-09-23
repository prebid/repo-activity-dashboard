/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // Turbopack is enabled via --turbo flag in dev command
  // No webpack config needed when using Turbopack

  // Ensure environment variables are available at build AND runtime
  env: {
    NEXTAUTH_URL: process.env.NEXTAUTH_URL,
    NEXT_PUBLIC_APP_URL: process.env.NEXT_PUBLIC_APP_URL,
    // Critical: This embeds the secret into the build
    NEXTAUTH_SECRET: process.env.NEXTAUTH_SECRET,
    // CRITICAL: AWS credentials MUST be embedded for auth to work
    S3_ACCESS_KEY_ID: process.env.S3_ACCESS_KEY_ID,
    S3_SECRET_ACCESS_KEY: process.env.S3_SECRET_ACCESS_KEY,
    S3_REGION: process.env.S3_REGION,
    AWS_REGION: process.env.AWS_REGION,
    DYNAMODB_USERS_TABLE: process.env.DYNAMODB_USERS_TABLE,
    DYNAMODB_WHITELIST_TABLE: process.env.DYNAMODB_WHITELIST_TABLE,
  },
};

export default nextConfig;