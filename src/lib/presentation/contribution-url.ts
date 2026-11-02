// Contribution report views in the URL codec: report targets as routes, the report scope as
// registry values, saved table presentation as explicit fields on links (decision C3), and child
// links that carry their parent as a `back` frame (P5d).
import { repositoryCatalog } from '@/config/repositories';
import { contributionActorTypes, type ContributionFocus } from '@/models/contributions';
import type { ContributionArea } from '@/models/contribution-page';
import type { ContributionTableKind } from '@/models/contribution-preferences';
import type {
  ContributionControlDirectory,
  ContributionSettings,
} from '@/models/contribution-settings';
import type { TableQuery } from '@/models/table-query';
import type { UrlView } from './url/back';
import { parseQuery } from './url/codec';
import {
  columnTableOf,
  columnTokens,
  contributionTableOf,
  visibleColumns,
  type UrlColumnTable,
} from './url/defaults';
import { periodSelection, periodValue } from './url/period';
import {
  matchRoute,
  type UrlRoute,
  type UrlSegments,
  type UrlValue,
  type UrlValues,
} from './url/registry';
import { defaultContributionSettings } from './contribution-settings-rules';

export type ContributionTarget =
  ContributionArea | Exclude<ContributionFocus, { kind: 'overview' }>;
export type ContributionRoute =
  '/contributors' | '/companies' | '/contributors/[accountId]' | '/companies/[...identity]';
type Values = Record<string, UrlValue>;

/** The route and segments a report target opens. */
export function contributionTarget(target: ContributionTarget): {
  route: ContributionRoute;
  segments: UrlSegments;
} {
  if (typeof target === 'string')
    return { route: target === 'contributors' ? '/contributors' : '/companies', segments: {} };
  if (target.kind === 'contributor')
    return { route: '/contributors/[accountId]', segments: { accountId: [target.accountId] } };
  return {
    route: '/companies/[...identity]',
    segments: { identity: target.companyId === null ? ['unmapped'] : ['id', target.companyId] },
  };
}
/** The route of an area's report, or of a subject's report in that area. */
export function contributionReportRoute(
  area: ContributionArea,
  focus: ContributionFocus = { kind: 'overview' },
) {
  return contributionTarget(focus.kind === 'overview' ? area : focus);
}

const slugById = new Map(repositoryCatalog.map((row) => [row.id, row.slug]));
const idBySlug = new Map(repositoryCatalog.map((row) => [row.slug, row.id]));
/** Fields that hold the report scope; a scope change replaces all of them. */
export const contributionScopeFields = [
  'period',
  'repo',
  'type',
  'account',
  'company',
  'exclude',
] as const;
/** A report scope as registry values; the serializer leaves out the ones at their defaults. */
export function contributionScopeValues(settings: ContributionSettings): Values {
  const { selection } = settings;
  const values: Values = {
    period: periodValue(settings.period),
    repo: selection.repositoryIds.map((id) => slugById.get(id) ?? id),
    type: contributionActorTypes.filter((type) => selection.actorTypes.includes(type)),
  };
  if (selection.population.kind === 'selected') {
    const { accountIds, companyIds } = selection.population;
    // A selected population is the presence of `account` or `company`, even when both are empty.
    if (accountIds.length || !companyIds.length) values.account = [...accountIds];
    if (companyIds.length) values.company = companyIds.map((id) => id ?? 'unmapped');
  }
  if (selection.excludedAccountIds.length) values.exclude = [...selection.excludedAccountIds];
  return values;
}
const list = (value: UrlValue | undefined) => (typeof value === 'object' ? [...value] : undefined);
const enabledRepositoryIds = repositoryCatalog.filter((row) => row.enabled).map((row) => row.id);
/**
 * The report scope registry values name, before the directory checks its accounts, companies and
 * range; null when the period is malformed. Absent fields are the defaults over `directory`, or
 * over the enabled catalog repositories.
 */
export function contributionScopeInput(
  values: UrlValues,
  directory?: ContributionControlDirectory,
): ContributionSettings | null {
  const period = periodSelection(typeof values.period === 'string' ? values.period : 'this-year');
  if (!period) return null;
  const defaults = directory
    ? defaultContributionSettings(directory)
    : defaultContributionSettings({ repositories: [] });
  if (!directory) defaults.selection.repositoryIds = [...enabledRepositoryIds];
  const accounts = list(values.account),
    companies = list(values.company);
  return {
    period,
    selection: {
      repositoryIds:
        list(values.repo)?.map((slug) => idBySlug.get(slug) ?? slug) ??
        defaults.selection.repositoryIds,
      actorTypes: (list(values.type) as ContributionSettings['selection']['actorTypes']) ?? [
        ...defaults.selection.actorTypes,
      ],
      population:
        accounts || companies
          ? {
              kind: 'selected',
              accountIds: accounts ?? [],
              companyIds: (companies ?? []).map((id) => (id === 'unmapped' ? null : id)),
            }
          : { kind: 'all' },
      excludedAccountIds: list(values.exclude) ?? [],
    },
  };
}

/** One table's saved presentation as the cookie holds it, after server validation. */
export interface SavedContributionTable {
  readonly columns?: Readonly<Record<string, boolean>>;
  readonly hideZeroMembers?: boolean;
  readonly sort?: Pick<TableQuery, 'sort' | 'descending'> | null;
}
/** Every contribution table's saved presentation, by table kind. */
export type SavedContributionTables = Partial<
  Record<ContributionTableKind, SavedContributionTable>
>;
/** Columns a table always shows, whatever a saved or legacy list says. */
const alwaysShown: ReadonlySet<string> = new Set(['name', 'record']);
/** The columns a table shows from saved choices: each saved choice, else its v1 default. */
function savedVisible(table: UrlColumnTable, columns: Readonly<Record<string, boolean>>) {
  return table.ids.filter(
    (id) => alwaysShown.has(id) || (columns[id] ?? table.visible.has(id)) === true,
  );
}
/**
 * The saved presentation of the table a view shows, as explicit fields (decision C3): `cols`,
 * `sort` and, for company members, `zero`. A saved sort on a column the table lacks does not apply.
 */
export function savedPresentationValues(
  route: UrlRoute,
  values: UrlValues,
  saved: SavedContributionTables | undefined,
): Values {
  const entry = saved?.[contributionTableOf(route, values)];
  const table = columnTableOf(route, values);
  const result: Values = {};
  if (!entry || !table) return result;
  if (entry.columns) {
    const tokens = columnTokens(table, savedVisible(table, entry.columns));
    if (tokens.length) result.cols = tokens;
  }
  if (entry.sort && table.ids.includes(entry.sort.sort))
    result.sort = (entry.sort.descending ? '-' : '') + entry.sort.sort;
  if (contributionTableOf(route, values) === 'members' && entry.hideZeroMembers)
    result.zero = 'hide';
  return result;
}
/** The columns a view shows, by column ID; null when `cols` names a column the table lacks. */
export function contributionColumnVisibility(
  route: UrlRoute,
  values: UrlValues,
): Record<string, boolean> | null {
  const table = columnTableOf(route, values);
  if (!table) return null;
  const visible = visibleColumns(table, list(values.cols) ?? []);
  return (
    visible &&
    Object.fromEntries(table.ids.map((id) => [id, alwaysShown.has(id) || visible.includes(id)]))
  );
}
/** `cols` for a visibility choice: the diff against the view's v1 columns. */
export function contributionColumnTokens(
  route: UrlRoute,
  values: UrlValues,
  visibility: Readonly<Record<string, boolean>>,
): string[] {
  const table = columnTableOf(route, values);
  return table
    ? columnTokens(
        table,
        table.ids.filter((id) => alwaysShown.has(id) || visibility[id] !== false),
      )
    : [];
}

const origin = 'https://dashboard.invalid';
/** The contribution view a canonical href shows, or null for any other href. */
export function contributionViewOf(href: string): UrlView | null {
  const url = new URL(href, origin);
  const matched = url.origin === origin ? matchRoute(url.pathname) : null;
  if (!matched || matched.route.startsWith('/repos')) return null;
  const parsed = parseQuery(matched.route, url.search);
  return parsed.kind === 'canonical' ? { ...matched, values: parsed.values } : null;
}
/** Values without some fields. */
export function omitValues(values: UrlValues, names: readonly string[]): Values {
  const result: Values = { ...values };
  for (const name of names) delete result[name];
  return result;
}
export { childViewHref, levelViewHref } from './url/back';
