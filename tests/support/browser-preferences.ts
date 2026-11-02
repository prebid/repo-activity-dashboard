import type { BrowserContext } from '@playwright/test';
import {
  decodePreferenceCookie,
  encodePreferenceDocument,
  preferenceCookies,
} from '../../src/lib/presentation/preference-cookie';
import type { PreferenceBinding, PreferenceSectionKey } from '../../src/models/preferences';

/** The preview sign-in session Alice's saved preferences are bound to. */
export const previewAlice: PreferenceBinding = { accountId: 'preview-alice', authVersion: 0 };

/** Replace the browser's contributions cookie with these sections, oldest first. */
export async function seedContributionPreferences(
  context: BrowserContext,
  baseURL: string,
  sections: Partial<Record<PreferenceSectionKey, unknown>>,
  binding: PreferenceBinding = previewAlice,
) {
  let updated = 0;
  const value = encodePreferenceDocument({
    cookie: 'contributions',
    binding,
    sections: Object.fromEntries(
      Object.entries(sections).map(([section, value]) => [section, { updated: updated++, value }]),
    ),
  });
  await context.addCookies([
    { name: preferenceCookies.contributions.name, value, url: new URL('/', baseURL).href },
  ]);
}

/** The contributions cookie's sections for a session, or null when it holds none for it. */
export async function contributionPreferences(
  context: BrowserContext,
  binding: PreferenceBinding = previewAlice,
): Promise<Partial<Record<PreferenceSectionKey, unknown>> | null> {
  const raw = (await context.cookies()).find(
    (cookie) => cookie.name === preferenceCookies.contributions.name,
  )?.value;
  const read = decodePreferenceCookie('contributions', raw, binding);
  return read.status === 'bound'
    ? Object.fromEntries(
        Object.entries(read.document.sections).map(([key, entry]) => [key, entry.value]),
      )
    : null;
}
