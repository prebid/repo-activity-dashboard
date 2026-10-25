import 'server-only';
import { createAccountClient } from '@/lib/aws/clients';
import { accountTargetSchema } from '@/models/account-target';
import { isPreviewBuild } from '@/lib/presentation/preview';
import { getRuntimeSettings } from './runtime-settings';
import { createAccountStore, type AccountStore } from './account-store';
let store: AccountStore | undefined;
export function getServerAccountStore(): AccountStore {
  if (isPreviewBuild) throw new Error('Account storage is unavailable in preview mode.');
  if (!store) {
    const settings = getRuntimeSettings();
    const parsed = accountTargetSchema.safeParse({
      region: settings.region,
      usersTable: settings.usersTable,
      whitelistTable: settings.whitelistTable,
    });
    if (!parsed.success) throw new Error('Missing or invalid account-store configuration.');
    const target = parsed.data;
    const accessKeyId = process.env.S3_ACCESS_KEY_ID,
      secretAccessKey = process.env.S3_SECRET_ACCESS_KEY;
    const client = createAccountClient({
      region: target.region,
      ...(!settings.managed && accessKeyId && secretAccessKey
        ? {
            credentials: {
              accessKeyId,
              secretAccessKey,
              sessionToken: process.env.S3_SESSION_TOKEN,
            },
          }
        : {}),
    });
    store = createAccountStore(client, target);
  }
  return store;
}
