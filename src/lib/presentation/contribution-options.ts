import type { ContributionDirectory } from '@/models/contribution-settings';
import type {
  ContributionChoiceQuery,
  ContributionChoicePage,
} from '@/models/contribution-options';
import { tablePageSize } from '@/models/table-query';
/** Selection affects the result set, never the retained draft selection in the picker. */
export function selectContributionChoices(
  directory: ContributionDirectory,
  query: ContributionChoiceQuery,
): ContributionChoicePage {
  const selected = query.selectedIds === null ? null : new Set(query.selectedIds);
  const options =
    query.kind === 'accounts'
      ? directory.accounts.map((account) => ({
          value: account.id,
          label: account.name + ' (@' + account.login + ')',
        }))
      : [
          ...directory.companies.map((company) => ({ value: company.id, label: company.name })),
          { value: '', label: 'Unmapped company' },
        ];
  const search = query.search.toLocaleLowerCase('en');
  const matching = options.filter(
    (option) =>
      (!selected || selected.has(option.value)) &&
      option.label.toLocaleLowerCase('en').includes(search),
  );
  const page = Math.min(query.page, Math.max(0, Math.ceil(matching.length / tablePageSize) - 1));
  return {
    choices: matching.slice(page * tablePageSize, (page + 1) * tablePageSize),
    total: matching.length,
    page,
  };
}
