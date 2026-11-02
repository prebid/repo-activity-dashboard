import { readRepositoryFilterValues } from './url/legacy/repository';
export { readRepositoryFilterValues };
import {
  repositoryPageFiltersSchema,
  type RepositoryPageFilters,
  type RepositoryPageSource,
} from '@/models/repository-page';
import { repositoryFilterError } from './repository-page-rules';
import { dateRangeSchema } from '@/models/reporting-period';

export function defaultRepositoryFilters(
  kind: RepositoryPageSource['kind'],
): RepositoryPageFilters {
  return repositoryPageFiltersSchema.parse({ kind });
}

/** Invalid explicit filters must never silently broaden a bookmarked cohort. */
export function readRepositoryFilters(
  search: string,
  source: RepositoryPageSource,
): RepositoryPageFilters | null {
  const filters = readRepositoryFilterValues(search, source.kind);
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

export function writeRepositoryFilters(search: string, filters: RepositoryPageFilters): string {
  const params = new URLSearchParams(search),
    prefix = filters.kind + '.filter.';
  for (const key of [...params.keys()]) if (key.startsWith(prefix)) params.delete(key);
  for (const [field, value] of changedFilterFields(filters)) {
    if (field === 'eventRange') {
      const range = dateRangeSchema.parse(value);
      params.set(prefix + 'eventFrom', range.start);
      params.set(prefix + 'eventTo', range.end);
      params.set(prefix + 'eventInclusive', range.endInclusive ? '1' : '0');
    } else if (Array.isArray(value))
      for (const item of [...new Set(value)]) params.append(prefix + field, item);
    else if (typeof value === 'string' || typeof value === 'number')
      params.set(prefix + field, String(value));
  }
  if (filters.search) params.set(filters.kind + '.q', filters.search);
  else params.delete(filters.kind + '.q');
  params.delete(filters.kind + '.page');
  return params.toString();
}
