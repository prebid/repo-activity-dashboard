import 'server-only';
import { AuthStateError } from './auth-errors';
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
    if (!parsed.success)
      throw new AuthStateError(
        'configuration',
        undefined,
        'Missing or invalid account-store configuration.',
      );
    const target = parsed.data;
    const client = createAccountClient({ region: target.region });
    store = createAccountStore(client, target, {
      temporaryPasswordHours: settings.temporaryPasswordHours,
    });
  }
  return store;
}
