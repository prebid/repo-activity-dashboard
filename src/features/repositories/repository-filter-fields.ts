import type { RepositoryPageFilters, RepositoryPageSource } from '@/models/repository-page';
import { ageBands } from '@/lib/presentation/repository-page-values';
import { actorLabels } from './repository-records-view';
export interface RepositoryFilterField {
  key: string;
  label: string;
  options: { value: string; label: string }[];
  multiple?: boolean;
}
const values = (items: string[]) =>
  [...new Set(items)]
    .sort((a, b) => a.localeCompare(b, 'en'))
    .map((value) => ({ value, label: value }));
const options = (items: Record<string, string>) =>
  Object.entries(items).map(([value, label]) => ({ value, label }));
export function repositoryFilterFields(source: RepositoryPageSource): RepositoryFilterField[] {
  const current = source.drilldown.selection.scope === 'current';
  const fields: RepositoryFilterField[] = [
    {
      key: 'labels',
      label: 'Labels',
      multiple: true,
      options: values(source.rows.flatMap((row) => row.labels)),
    },
    {
      key: 'authors',
      label: 'Authors',
      multiple: true,
      options: values(source.rows.map((row) => row.author.toLowerCase())),
    },
    {
      key: 'authorTypes',
      label: 'Author type',
      multiple: true,
      options: options({ human: 'Human', agent: 'Prebid agent', bot: 'Bot', unknown: 'Unknown' }),
    },
    {
      key: 'latestActors',
      label: 'Latest activity by',
      multiple: true,
      options: options(actorLabels),
    },
  ];
  if (current)
    fields.push({
      key: 'ageBand',
      label: 'Age',
      options: [
        { value: '', label: 'Any age' },
        ...ageBands.map((band) => ({ value: String(band.key), label: band.label })),
      ],
    });
  fields.push({
    key: 'states',
    label: 'Current state',
    multiple: true,
    options: values(source.kind === 'prs' ? ['Open', 'Merged', 'Closed'] : ['Open', 'Closed']),
  });
  if (source.kind === 'prs') {
    fields.push(
      {
        key: 'draft',
        label: 'Draft status',
        options: options({ all: 'All PRs', drafts: 'Drafts only', 'non-drafts': 'Exclude drafts' }),
      },
      {
        key: 'branches',
        label: 'Target branch',
        multiple: true,
        options: values(source.rows.map((row) => row.baseBranch)),
      },
    );
    if (current) {
      const reviews = options({
        '': 'Any count',
        '0': 'Zero',
        '1': 'One',
        '2': 'Two',
        more: 'More than two',
        unknown: 'Unknown',
      });
      const coverage = options({
        '': 'Any coverage',
        yes: 'Has reviewed',
        no: 'Has not reviewed',
        unknown: 'Unknown',
      });
      fields.push(
        { key: 'reviewers', label: 'Human reviewers', options: reviews },
        { key: 'approvals', label: 'Current human approvals', options: reviews },
        { key: 'agentReviewer', label: 'Prebid agent reviewers', options: coverage },
        { key: 'botReviewer', label: 'Bot reviewers', options: coverage },
      );
    }
  } else
    fields.push(
      {
        key: 'assignees',
        label: 'Assignees',
        multiple: true,
        options: values(
          source.rows.flatMap((row) => row.assignees ?? []).map((account) => account.toLowerCase()),
        ),
      },
      {
        key: 'assignment',
        label: 'Assignment',
        options: options({
          any: 'Any assignment',
          assigned: 'Assigned',
          unassigned: 'Unassigned',
          unknown: 'Unknown',
        }),
      },
    );
  return fields;
}
export function repositoryFilterChips(
  filters: RepositoryPageFilters,
  fields: RepositoryFilterField[],
) {
  return fields.flatMap((field) => {
    const value: unknown = (filters as unknown as Record<string, unknown>)[field.key];
    const chosen = Array.isArray(value)
      ? (value as string[])
      : value === undefined || value === 'all' || value === 'any'
        ? []
        : typeof value === 'string' || typeof value === 'number'
          ? [String(value)]
          : [];
    return chosen.map((value) => ({
      key: field.key,
      value,
      label:
        field.label +
        ': ' +
        (field.options.find((option) => option.value === value)?.label ?? value),
    }));
  });
}
