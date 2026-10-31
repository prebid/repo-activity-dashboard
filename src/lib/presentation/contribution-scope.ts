import {
  contributionActorTypes,
  contributionSelectionSchema,
  contributionFocusSchema,
  type ContributionSource,
  type ContributionAccount,
  type ContributionSelection,
  type ContributionFocus,
} from '@/models/contributions';
import { contributionIndex } from './contribution-index';
export function defaultContributionSelection(source: ContributionSource): ContributionSelection {
  return {
    repositoryIds: source.repositories.map((row) => row.id),
    actorTypes: [...contributionActorTypes],
    population: { kind: 'all' },
    excludedAccountIds: [],
  };
}
export function contributionScope(
  input: ContributionSource,
  requested?: ContributionSelection,
  requestedFocus: ContributionFocus = { kind: 'overview' },
) {
  const index = contributionIndex(input),
    source = index.source;
  const selection = contributionSelectionSchema.parse(
    requested ?? defaultContributionSelection(source),
  );
  const focus = contributionFocusSchema.parse(requestedFocus);
  const accountIds = new Set(source.accounts.map((row) => row.id));
  const repositoryIds = new Set(source.repositories.map((row) => row.id));
  const companyKnown = (id: string | null) => id === null || !!index.company(id);
  if (
    selection.repositoryIds.some((id) => !repositoryIds.has(id)) ||
    selection.excludedAccountIds.some((id) => !accountIds.has(id))
  )
    throw Error('Unknown contribution selection');
  if (
    selection.population.kind === 'selected' &&
    (selection.population.accountIds.some((id) => !accountIds.has(id)) ||
      selection.population.companyIds.some((id) => !companyKnown(id)))
  )
    throw Error('Unknown selected population');
  if (
    (focus.kind === 'contributor' && !accountIds.has(focus.accountId)) ||
    (focus.kind === 'company' && !companyKnown(focus.companyId))
  )
    throw Error('Unknown contribution focus');
  const excluded = new Set(selection.excludedAccountIds);
  const included = new Set(
    selection.population.kind === 'selected' ? selection.population.accountIds : [],
  );
  const includedCompanies = new Set(
    selection.population.kind === 'selected' ? selection.population.companyIds : [],
  );
  const accounts = source.accounts.filter(
    (account) =>
      selection.actorTypes.includes(account.actorType) &&
      !excluded.has(account.id) &&
      (selection.population.kind === 'all' ||
        included.has(account.id) ||
        includedCompanies.has(account.companyId)) &&
      (focus.kind !== 'contributor' || account.id === focus.accountId) &&
      (focus.kind !== 'company' || account.companyId === focus.companyId),
  );
  const chosenRepositories = new Set(selection.repositoryIds);
  const repositories = source.repositories.filter((repo) => chosenRepositories.has(repo.id));
  const companyFor = (id: string | null) => (id === null ? null : (index.company(id) ?? null));
  const grouped = new Map<string | null, ContributionAccount[]>();
  for (const account of accounts) {
    const members = grouped.get(account.companyId) ?? [];
    members.push(account);
    grouped.set(account.companyId, members);
  }
  return {
    index,
    source,
    selection,
    focus,
    accounts,
    repositories,
    chosenRepositories,
    companyFor,
    grouped,
  };
}
