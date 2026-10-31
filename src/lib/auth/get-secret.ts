import 'server-only';
import { SecretsManagerClient, GetSecretValueCommand } from '@aws-sdk/client-secrets-manager';
import { isPreviewBuild } from '@/lib/presentation/preview';
import { getRuntimeSettings } from './runtime-settings';
import { makeSecretLoader, validateAuthSecret, previewSecret } from './secret-policy';
import { awsClientPolicy } from '@/lib/aws/client-policy';
import { getLegacyAuthSettings } from './legacy-runtime';
const clients = new Map<string, SecretsManagerClient>();
const managedSecret = makeSecretLoader(async (arn, signal) => {
  const region = arn.split(':')[3];
  let client = clients.get(region);
  if (!client) {
    client = new SecretsManagerClient({
      region,
      ...awsClientPolicy,
    });
    clients.set(region, client);
  }
  const result = await client.send(new GetSecretValueCommand({ SecretId: arn }), {
    abortSignal: signal,
  });
  return result.SecretString;
});
export async function getSecret(): Promise<string> {
  if (isPreviewBuild) return previewSecret;
  const settings = getRuntimeSettings();
  if (settings.authBackend === 'legacy') return getLegacyAuthSettings().secret;
  if (settings.secretArn) return managedSecret(settings.secretArn);
  return validateAuthSecret(process.env.AUTH_SECRET);
}
