import {
  repositoryPageFiltersSchema,
  type RepositoryPageFilters,
  type RepositoryPageSource,
} from '@/models/repository-page';
import { repositoryFilterError } from './repository-page-rules';
import { dateRangeSchema } from '@/models/reporting-period';

const arrayFields = [
  'labels',
  'authors',
  'authorTypes',
  'states',
  'latestActors',
  'branches',
  'assignees',
] as const;
const scalarFields = [
  'draft',
  'assignment',
  'ageBand',
  'reviewers',
  'approvals',
  'agentReviewer',
  'botReviewer',
] as const;
const rangeFields = ['eventFrom', 'eventTo', 'eventInclusive'] as const;
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
/** Shared syntax decoder; each consumer applies its own current/historical compatibility rule. */
export function readRepositoryFilterValues(
  search: string,
  kind: 'prs' | 'issues',
): RepositoryPageFilters | null {
  const params = new URLSearchParams(search),
    prefix = kind + '.filter.';
  if (params.getAll(kind + '.q').length > 1) return null;
  const input: Record<string, unknown> = {
    kind,
    search: params.get(kind + '.q') ?? '',
  };
  for (const key of params.keys())
    if (
      key.startsWith(prefix) &&
      ![...arrayFields, ...scalarFields, ...rangeFields].some((field) => key === prefix + field)
    )
      return null;
  for (const field of arrayFields)
    if (params.has(prefix + field)) input[field] = params.getAll(prefix + field);
  for (const field of scalarFields)
    if (params.has(prefix + field)) {
      if (params.getAll(prefix + field).length !== 1) return null;
      if (field === 'ageBand' && !/^(0|30|60|90|120|180|360)$/.test(params.get(prefix + field)!))
        return null;
      input[field] =
        field === 'ageBand' ? Number(params.get(prefix + field)) : params.get(prefix + field);
    }
  if (rangeFields.some((field) => params.has(prefix + field))) {
    if (rangeFields.some((field) => params.getAll(prefix + field).length !== 1)) return null;
    const inclusive = params.get(prefix + 'eventInclusive');
    input.eventRange = {
      start: params.get(prefix + 'eventFrom'),
      end: params.get(prefix + 'eventTo'),
      endInclusive: inclusive === '1' ? true : inclusive === '0' ? false : undefined,
    };
  }
  const parsed = repositoryPageFiltersSchema.safeParse(input);
  if (!parsed.success) return null;
  return parsed.data;
}

export function writeRepositoryFilters(search: string, filters: RepositoryPageFilters): string {
  const params = new URLSearchParams(search),
    prefix = filters.kind + '.filter.';
  for (const key of [...params.keys()]) if (key.startsWith(prefix)) params.delete(key);
  const defaults = defaultRepositoryFilters(filters.kind);
  for (const [field, value] of Object.entries(filters)) {
    if (
      field === 'kind' ||
      field === 'search' ||
      value === undefined ||
      JSON.stringify(value) === JSON.stringify(defaults[field as keyof typeof defaults])
    )
      continue;
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
