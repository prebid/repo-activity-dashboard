import { z } from 'zod';
import { contributionSelectionSchema, type ContributionSource } from './contributions';
import { periodSelectionSchema } from './reporting-period';

export const contributionSettingsSchema = z
  .object({
    period: periodSelectionSchema,
    selection: contributionSelectionSchema,
  })
  .strict();
export type ContributionSettings = z.infer<typeof contributionSettingsSchema>;
/** Picker identities only; no records, credits or client-side metric calculation. */
export type ContributionDirectory = Pick<
  ContributionSource,
  'accounts' | 'companies' | 'repositories'
>;
