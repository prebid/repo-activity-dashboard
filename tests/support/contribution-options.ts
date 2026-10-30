import type { ContributionDirectory } from '@/models/contribution-settings';
import type { ContributionOptions } from '@/models/contribution-options';
import { selectContributionChoices } from '@/lib/presentation/contribution-options';
import { validateContributionSettings } from '@/lib/presentation/contribution-settings';
export function localContributionOptions(
  directory: ContributionDirectory,
  asOf: string,
): ContributionOptions {
  return {
    choices: (query) => Promise.resolve(selectContributionChoices(directory, query)),
    validate: (settings) =>
      Promise.resolve(validateContributionSettings(settings, directory, asOf)),
  };
}
