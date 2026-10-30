import { z } from 'zod';
import {
  contributionSelectionSchema,
  contributionAccountSchema,
  contributionCompanySchema,
  contributionRepositorySchema,
  type ContributionSource,
} from './contributions';
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
/** The report needs repository controls, not the complete account/company catalogue. */
export type ContributionControlDirectory = Pick<ContributionDirectory, 'repositories'>;
export const contributionDirectorySchema = z
  .object({
    accounts: z.array(contributionAccountSchema),
    companies: z.array(contributionCompanySchema),
    repositories: z.array(contributionRepositorySchema),
  })
  .strict();
