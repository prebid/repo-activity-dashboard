import { readRepositoryFilterValues, writeRepositoryFilters } from './url/legacy/repository';
export { readRepositoryFilterValues, writeRepositoryFilters };
import {
  repositoryPageFiltersSchema,
  type RepositoryPageFilters,
  type RepositoryPageSource,
} from '@/models/repository-page';
import { dateRangeSchema } from '@/models/reporting-period';
import { repositoryFilterError } from './repository-page-rules';
import { periodAt, periodRange, periodSelection, periodValue } from './url/period';
import type { UrlValue, UrlValues } from './url/registry';

export function defaultRepositoryFilters(
  kind: RepositoryPageSource['kind'],
): RepositoryPageFilters {
  return repositoryPageFiltersSchema.parse({ kind });
}

/** The URL fields record filters use; `q` is the record table's search. */
export const repositoryFilterNames = [
  'authors',
  'authorTypes',
  'states',
  'latestActors',
  'assignees',
  'labels',
  'branches',
  'draft',
  'assignment',
  'ageBand',
  'reviewers',
  'approvals',
  'agentReviewer',
  'botReviewer',
  'events',
] as const;

/**
 * Record filters from URL values, or null when a value is not a filter of this list kind. The
 * `events` period resolves against `at`, the instant the list is pinned to.
 */
export function readRepositoryFilterFields(
  values: UrlValues,
  kind: RepositoryPageSource['kind'],
  at: string,
): RepositoryPageFilters | null {
  const input: Record<string, unknown> = { kind, search: values.q ?? '' };
  for (const name of repositoryFilterNames) {
    const value = values[name];
    if (value === undefined || name === 'events') continue;
    input[name] = name === 'ageBand' ? Number(value) : value;
  }
  if (typeof values.events === 'string') {
    const selected = periodSelection(values.events);
    const range = selected && periodRange(selected, at);
    if (!range) return null;
    input.eventRange = range;
  }
  const parsed = repositoryPageFiltersSchema.safeParse(input);
  return parsed.success ? parsed.data : null;
}

/** Invalid explicit filters must never silently broaden a bookmarked cohort. */
export function readRepositoryFilters(
  values: UrlValues,
  source: RepositoryPageSource,
  at: string,
): RepositoryPageFilters | null {
  const filters = readRepositoryFilterFields(values, source.kind, at);
  return filters && !repositoryFilterError(filters, source.drilldown.selection) ? filters : null;
}

/** The filter fields that differ from their defaults: the ones a URL writes. */
function changedFilterFields(filters: RepositoryPageFilters) {
  const defaults = defaultRepositoryFilters(filters.kind);
  return Object.entries(filters).filter(
    ([field, value]) =>
      field !== 'kind' &&
      field !== 'search' &&
      value !== undefined &&
      JSON.stringify(value) !== JSON.stringify(defaults[field as keyof typeof defaults]),
  );
}

/** Whether a search or any filter narrows the selected scope's records. */
export function repositoryFiltersNarrow(filters: RepositoryPageFilters): boolean {
  return Boolean(filters.search) || changedFilterFields(filters).length > 0;
}

/**
 * Record filters as URL fields, every filter name present: a filter at its default is undefined,
 * so spreading the result over a view's values clears it. An event range is written as the period
 * that resolves to it at `at`.
 */
export function repositoryFilterFields(
  filters: RepositoryPageFilters,
  at: string,
): Record<string, UrlValue | undefined> {
  const fields: Record<string, UrlValue | undefined> = Object.fromEntries(
    repositoryFilterNames.map((name) => [name, undefined]),
  );
  fields.q = filters.search || undefined;
  for (const [field, value] of changedFilterFields(filters)) {
    if (field === 'eventRange') {
      const period = periodAt(dateRangeSchema.parse(value), at);
      if (!period) throw new Error('This activity range cannot be written as a period.');
      fields.events = periodValue(period);
    } else
      fields[field] = Array.isArray(value)
        ? [...new Set(value as string[])]
        : typeof value === 'number'
          ? String(value)
          : (value as string);
  }
  return fields;
}
