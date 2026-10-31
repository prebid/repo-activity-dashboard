import 'server-only';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import {
  legacyAuthSettings,
  legacyAuthSettingsSchema,
  type LegacyAuthSettings,
} from '@/models/legacy-auth-settings';
import { AuthStateError } from './auth-errors';
let settings: LegacyAuthSettings | undefined;
export function getLegacyAuthSettings(): LegacyAuthSettings {
  if (settings) return settings;
  try {
    for (const path of ['.next/server/dashboard-legacy-auth.json', '.dashboard-legacy-auth.json']) {
      try {
        const data: unknown = JSON.parse(readFileSync(resolve(process.cwd(), path), 'utf8'));
        return (settings = legacyAuthSettingsSchema.parse(data));
      } catch (error) {
        if (!(error instanceof Error && 'code' in error && error.code === 'ENOENT')) throw error;
      }
    }
    return (settings = legacyAuthSettings(process.env));
  } catch {
    // Do not attach schema errors: they can include secret inputs.
    throw new AuthStateError(
      'configuration',
      undefined,
      'Existing account configuration is unavailable.',
    );
  }
}
