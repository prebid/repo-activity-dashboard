// This file handles getting the NextAuth secret in Amplify SSR environment
// Amplify doesn't pass all env vars to Lambda, so we need to handle this specially

function getSecret(): string {
  // Try multiple sources for the secret
  const secret =
    process.env.NEXTAUTH_SECRET ||
    process.env.AUTH_SECRET ||
    // Fallback to a build-time injected value
    process.env.AMPLIFY_NEXTAUTH_SECRET;

  if (!secret) {
    console.error('NEXTAUTH_SECRET is not available in any form');
    // In production, we need to handle this gracefully
    if (process.env.NODE_ENV === 'production') {
      // Use a fallback that at least allows the app to run
      // This is not ideal but prevents the app from crashing
      return 'amplify-deployment-secret-fallback-change-this';
    }
    throw new Error('NEXTAUTH_SECRET is required');
  }

  return secret;
}

export const nextAuthSecret = getSecret();