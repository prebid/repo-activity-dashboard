import { accountTypeLabels } from '@/models/github-account';
import {
  repositoryPageFiltersSchema,
  type RepositoryPageFilters,
  type RepositoryPageSource,
  type RepositoryFilterOptions,
} from '@/models/repository-page';
import type { ZodError } from 'zod';
import { defaultRepositoryFilters } from '@/lib/presentation/repository-page-query';
import { repositoryFilterOptions } from '@/lib/presentation/repository-page-filters';
import { ageBands } from '@/lib/presentation/repository-page-values';
import { actorLabels } from './repository-records-view';

type PrFilters = Extract<RepositoryPageFilters, { kind: 'prs' }>;
type IssueFilters = Extract<RepositoryPageFilters, { kind: 'issues' }>;
type EditableKeys<F> = Exclude<keyof F, 'kind' | 'search' | 'eventRange'>;
type Fields<F> = {
  [K in EditableKeys<F>]-?: {
    key: K;
    label: string;
    options: { value: string; label: string }[];
  } & (F[K] extends string[] ? { multiple: true } : { multiple?: false });
}[EditableKeys<F>];
export type RepositoryPrFilterField = Fields<PrFilters>;
export type RepositoryIssueFilterField = Fields<IssueFilters>;
export type RepositoryFilterField = RepositoryPrFilterField | RepositoryIssueFilterField;
export type RepositoryFilterKey = RepositoryFilterField['key'];
type SharedKey = Exclude<EditableKeys<PrFilters> & EditableKeys<IssueFilters>, 'states'>;
type SharedField = Extract<RepositoryPrFilterField, { key: SharedKey }>;
// Native form values remain unvalidated until Apply; keys and multiplicity are schema-bound.
export type RepositoryFilterDraft = Pick<RepositoryPageFilters, 'kind' | 'search' | 'eventRange'> &
  Partial<Record<RepositoryFilterKey, string | string[] | number | undefined>>;

const values = (items: string[]) =>
  [...new Set(items)]
    .sort((a, b) => a.localeCompare(b, 'en'))
    .map((value) => ({ value, label: value }));
const options = <T extends string>(items: Record<T, string>) =>
  (Object.keys(items) as T[]).map((value) => ({ value, label: items[value] }));
export function repositoryFilterFields(source: RepositoryPageSource): RepositoryFilterField[] {
  return repositoryFilterFieldsFromOptions({
    kind: source.kind,
    current: source.drilldown.selection.scope === 'current',
    ...repositoryFilterOptions(source.rows),
  });
}
/** `cutoff` describes historical snapshot rows: state is fixed and review counts are at the cutoff. */
export function repositoryFilterFieldsFromOptions(
  source: RepositoryFilterOptions & { kind: 'prs' | 'issues'; current: boolean; cutoff?: boolean },
): RepositoryFilterField[] {
  const current = source.current,
    cutoff = source.cutoff === true;
  const common: SharedField[] = [
    {
      key: 'labels',
      label: 'Labels',
      multiple: true,
      options: values(source.labels),
    },
    {
      key: 'authors',
      label: 'Authors',
      multiple: true,
      options: values(source.authors),
    },
    {
      key: 'authorTypes',
      label: 'Author type',
      multiple: true,
      options: options(accountTypeLabels),
    },
    {
      key: 'latestActors',
      label: 'Latest activity by',
      multiple: true,
      options: options(actorLabels),
    },
  ];
  if (current)
    common.push({
      key: 'ageBand',
      label: 'Age',
      options: [
        { value: '', label: 'Any age' },
        ...ageBands.map((band) => ({ value: String(band.key), label: band.label })),
      ],
    });
  if (source.kind === 'prs') {
    const fields: RepositoryPrFilterField[] = [
      ...common,
      ...(cutoff
        ? []
        : [
            {
              key: 'states',
              label: 'Current state',
              multiple: true,
              options: values(['Open', 'Merged', 'Closed']),
            } as const,
          ]),
      {
        key: 'draft',
        label: 'Draft status',
        options: options({ all: 'All PRs', drafts: 'Drafts only', 'non-drafts': 'Exclude drafts' }),
      },
      {
        key: 'branches',
        label: 'Target branch',
        multiple: true,
        options: values(source.branches),
      },
    ];
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
        {
          key: 'reviewers',
          label: cutoff ? 'Human reviewers at cutoff' : 'Human reviewers',
          options: reviews,
        },
        {
          key: 'approvals',
          label: cutoff ? 'Human approvals at cutoff' : 'Current human approvals',
          options: reviews,
        },
        { key: 'agentReviewer', label: 'Prebid agent reviewers', options: coverage },
        { key: 'botReviewer', label: 'Bot reviewers', options: coverage },
      );
    }
    return fields;
  }
  return [
    ...common,
    ...(cutoff
      ? []
      : [
          {
            key: 'states',
            label: 'Current state',
            multiple: true,
            options: values(['Open', 'Closed']),
          } as const,
        ]),
    {
      key: 'assignees',
      label: 'Assignees',
      multiple: true,
      options: values(source.assignees),
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
  ] satisfies RepositoryIssueFilterField[];
}
export function repositoryFilterValue(
  filters: RepositoryPageFilters,
  key: RepositoryFilterKey,
): string | string[] | number | undefined {
  switch (key) {
    case 'draft':
    case 'branches':
    case 'reviewers':
    case 'approvals':
    case 'agentReviewer':
    case 'botReviewer':
      return filters.kind === 'prs' ? filters[key] : undefined;
    case 'assignees':
    case 'assignment':
      return filters.kind === 'issues' ? filters[key] : undefined;
    default:
      return filters[key];
  }
}
export function removeRepositoryFilter(
  filters: RepositoryPageFilters,
  key: RepositoryFilterKey,
  value: string,
): RepositoryPageFilters {
  const current = repositoryFilterValue(filters, key);
  const next = Array.isArray(current)
    ? current.filter((item) => item !== value)
    : repositoryFilterValue(defaultRepositoryFilters(filters.kind), key);
  return repositoryPageFiltersSchema.parse({ ...filters, [key]: next });
}
export function repositoryFilterChips(
  filters: RepositoryPageFilters,
  fields: readonly RepositoryFilterField[],
) {
  return fields.flatMap((field) => {
    const current = repositoryFilterValue(filters, field.key);
    const chosen = Array.isArray(current)
      ? current
      : current === undefined || current === 'all' || current === 'any'
        ? []
        : [String(current)];
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
export function repositoryFilterErrorMessage(
  error: ZodError,
  fields: readonly RepositoryFilterField[],
): string {
  const issue = error.issues[0];
  const field = fields.find((field) => field.key === issue?.path[0]);
  if (!field) return 'These filters could not be applied. Check your selections.';
  if (issue.code === 'too_big' && issue.origin === 'array')
    return field.label + ': select at most ' + String(issue.maximum) + ' options.';
  return 'Choose a valid value for ' + field.label.toLowerCase() + '.';
}
