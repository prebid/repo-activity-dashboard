import 'server-only';
import { SecretsManagerClient, GetSecretValueCommand } from '@aws-sdk/client-secrets-manager';
import { isPreviewBuild } from '@/lib/presentation/preview';
import { getRuntimeSettings } from './runtime-settings';
import { makeSecretLoader, validateAuthSecret, previewSecret } from './secret-policy';
const clients = new Map<string, SecretsManagerClient>();
const managedSecret = makeSecretLoader(async (arn) => {
  const region = arn.split(':')[3];
  let client = clients.get(region);
  if (!client) {
    client = new SecretsManagerClient({
      region,
      maxAttempts: 2,
      requestHandler: { connectionTimeout: 1000, requestTimeout: 3000 },
    });
    clients.set(region, client);
  }
  const result = await client.send(new GetSecretValueCommand({ SecretId: arn }));
  return result.SecretString;
});
export async function getSecret(): Promise<string> {
  if (isPreviewBuild) return previewSecret;
  const settings = getRuntimeSettings();
  if (settings.authUrl) process.env.AUTH_URL = settings.authUrl;
  if (settings.secretArn) return managedSecret(settings.secretArn);
  return validateAuthSecret(
    process.env.NEXTAUTH_SECRET || process.env.AUTH_SECRET || process.env.AMPLIFY_NEXTAUTH_SECRET,
  );
}
