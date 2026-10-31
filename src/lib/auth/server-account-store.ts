import 'server-only';
import { AuthStateError } from './auth-errors';
import { createAccountClient } from '@/lib/aws/clients';
import { accountTargetSchema } from '@/models/account-target';
import { isPreviewBuild } from '@/lib/presentation/preview';
import { getRuntimeSettings } from './runtime-settings';
import { createAccountStore, type AccountStore } from './account-store';
import { createLegacyAccountStore } from './legacy-account-store';
import { getLegacyAuthSettings } from './legacy-runtime';
type WebAccountStore = AccountStore | ReturnType<typeof createLegacyAccountStore>;
let store: WebAccountStore | undefined;
export function getServerAccountStore(): WebAccountStore {
  if (isPreviewBuild) throw new Error('Account storage is unavailable in preview mode.');
  if (!store) {
    const settings = getRuntimeSettings();
    const parsed = accountTargetSchema.safeParse({
      region: settings.region,
      usersTable: settings.usersTable,
      whitelistTable: settings.whitelistTable,
    });
    if (!parsed.success)
      throw new AuthStateError(
        'configuration',
        undefined,
        'Missing or invalid account-store configuration.',
      );
    const target = parsed.data;
    if (settings.authBackend === 'legacy') {
      const client = createAccountClient({
        region: target.region,
        credentials: getLegacyAuthSettings().credentials,
      });
      return (store = createLegacyAccountStore(client, target));
    }
    const client = createAccountClient({ region: target.region });
    store = createAccountStore(client, target, {
      temporaryPasswordHours: settings.temporaryPasswordHours,
    });
  }
  return store;
}
