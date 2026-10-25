import { isPreviewBuild } from '@/lib/presentation/preview';
const previewSecret = 'local-preview-only-not-a-production-credential-2026';
export function getSecret(): string {
  if (isPreviewBuild) return previewSecret;
  const secret =
    process.env.NEXTAUTH_SECRET || process.env.AUTH_SECRET || process.env.AMPLIFY_NEXTAUTH_SECRET;
  if (!secret || secret === previewSecret)
    throw new Error('Production authentication requires its own secret.');
  return secret;
}
