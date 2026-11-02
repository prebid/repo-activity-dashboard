// Contribution scope defaults and validation, shared by URL readers, cookies and loaders.
import { contributionActorTypes, contributionDefaultPeriod } from '@/models/contributions';
import {
  contributionSettingsSchema,
  type ContributionSettings,
  type ContributionDirectory,
  type ContributionControlDirectory,
} from '@/models/contribution-settings';
import { resolveReportingPeriod } from './reporting-period';
export function defaultContributionSettings(
  directory: ContributionControlDirectory,
): ContributionSettings {
  return {
    period: contributionDefaultPeriod,
    selection: {
      repositoryIds: directory.repositories.map((row) => row.id),
      actorTypes: [...contributionActorTypes],
      population: { kind: 'all' },
      excludedAccountIds: [],
    },
  };
}
/** Invalid identities are rejected rather than silently broadening a report. */
export function normaliseSettings(
  input: unknown,
  directory: ContributionControlDirectory,
  asOf: string,
): ContributionSettings | null {
  const parsed = contributionSettingsSchema.safeParse(input);
  if (!parsed.success) return null;
  const { period, selection } = parsed.data;
  try {
    resolveReportingPeriod(period, asOf);
  } catch {
    return null;
  }
  const knownRepos = new Set(directory.repositories.map((row) => row.id));
  if (selection.repositoryIds.some((id) => !knownRepos.has(id))) return null;
  const population = selection.population;
  return {
    period,
    selection: {
      repositoryIds: [...new Set(selection.repositoryIds)].sort(),
      actorTypes: contributionActorTypes.filter((type) => selection.actorTypes.includes(type)),
      population:
        population.kind === 'all'
          ? population
          : {
              kind: 'selected',
              accountIds: [...new Set(population.accountIds)].sort(),
              companyIds: [...new Set(population.companyIds)].sort(),
            },
      excludedAccountIds: [...new Set(selection.excludedAccountIds)].sort(),
    },
  };
}
export function validateContributionSettings(
  input: unknown,
  directory: ContributionDirectory,
  asOf: string,
): ContributionSettings | null {
  const settings = normaliseSettings(input, directory, asOf);
  if (!settings) return null;
  const accounts = new Set(directory.accounts.map((row) => row.id));
  const companies = new Set(directory.companies.map((row) => row.id));
  const { selection } = settings,
    population = selection.population;
  if (
    selection.excludedAccountIds.some((id) => !accounts.has(id)) ||
    (population.kind === 'selected' &&
      (population.accountIds.some((id) => !accounts.has(id)) ||
        population.companyIds.some((id) => id !== null && !companies.has(id))))
  )
    return null;
  return settings;
}
