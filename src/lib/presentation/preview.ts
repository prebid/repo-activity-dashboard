export const isPreviewBuild = process.env.NEXT_PUBLIC_APP_MODE === 'preview';
export const previewAccounts = [
  { id: 'preview-alice', email: 'alice@example.test', name: 'Alice (sample)', role: 'viewer' },
  { id: 'preview-bob', email: 'bob@example.test', name: 'Bob (sample)', role: 'viewer' },
] as const;
