// The Contributors, Reviewers and Companies lenses in presentation: which lens a location shows,
// the cookie sections each lens saves into, the Column set choice and its lead sorts, and the
// lens-named crumb.
import type { ColumnSetChoice, ColumnSetOption } from '@/models/column-selection';
import {
  columnSetIds,
  columnSetLabels,
  columnSetMetrics,
  lensDefaultSort,
  roleMetrics,
  type ColumnSetId,
  type ContributionLens,
} from '@/models/contribution-lens';
import { reportMetricIds } from '@/models/contribution-metrics';
import type { ContributionArea } from '@/models/contribution-page';
import type { ContributionTableKind } from '@/models/contribution-preferences';
import type { ContributionValues } from '@/models/contributions';
import type { PreferenceSectionKey } from '@/models/preferences';
import type { UrlView } from './url/back';
import { screenOf } from './url/registry';

/**
 * The lens a location shows: `/reviewers`, or `lens=reviewers` on another contribution route, is
 * the Reviewers lens; `lens=all` on a /contributors or /companies path is the Companies lens;
 * anything else is Contributors. `search` is a page's query, or null where no query is known
 * (Storybook without a router).
 */
export function contributionLensForLocation(
  pathname: string,
  search: Pick<URLSearchParams, 'get'> | null,
): ContributionLens {
  if (pathname === '/reviewers' || pathname.startsWith('/reviewers/')) return 'reviewers';
  if (!/^\/(?:contributors|companies)(?:\/|$)/.test(pathname)) return 'contributors';
  const lens = search?.get('lens');
  return lens === 'reviewers' || lens === 'all' ? lens : 'contributors';
}
/**
 * An area overview's path in a lens: the people overview is /reviewers in the Reviewers lens. The
 * Companies lens has no people overview; both areas open /companies, which carries `lens=all`.
 */
export function contributionOverviewPath(
  area: ContributionArea,
  lens: ContributionLens = 'contributors',
): '/contributors' | '/reviewers' | '/companies' {
  return area === 'companies' || lens === 'all'
    ? '/companies'
    : lens === 'reviewers'
      ? '/reviewers'
      : '/contributors';
}
/** A lens's prefix in its own cookie section keys; the Contributors lens has none. */
const lensSectionPrefix = (lens: ContributionLens) => (lens === 'contributors' ? '' : lens + '.');
/**
 * The cookie sections a table's columns and sort are saved in. Each lens saves its own; supporting
 * records (`details`) are shared, because their columns do not depend on the lens.
 */
export function contributionTableSections(
  lens: ContributionLens,
  table: ContributionTableKind,
): { columns: PreferenceSectionKey; sort: PreferenceSectionKey } {
  const prefix = 'contributions.' + (table === 'details' ? '' : lensSectionPrefix(lens));
  return {
    columns: (prefix + table + '.columns') as PreferenceSectionKey,
    sort: (prefix + table + '.sort') as PreferenceSectionKey,
  };
}
/** The section a contribution Over time view's presentation is saved in, per lens. */
export function contributionTimelineSection(
  lens: ContributionLens,
  area: ContributionArea,
  focus: 'overview' | 'contributor' | 'company',
): PreferenceSectionKey {
  return ('timeline.' + lensSectionPrefix(lens) + area + '.' + focus) as PreferenceSectionKey;
}

/** The Column set choices for a table whose hideable columns are `hideableIds`. */
export function columnSetOptions(hideableIds: readonly string[]): ColumnSetOption[] {
  return columnSetIds.map((id) => ({
    id,
    label: columnSetLabels[id],
    columnIds: id === 'all' ? [...hideableIds] : columnSetMetrics[id],
  }));
}
/**
 * The Column set choice a table offers: the sets decide its metric columns, and All columns every
 * hideable column. `onChoose` receives a set's ID.
 */
export function columnSetChoice(
  hideableIds: readonly string[],
  onChoose: (id: string) => void,
): ColumnSetChoice {
  return {
    label: 'Column set',
    domain: reportMetricIds.filter((id) => hideableIds.includes(id)),
    options: columnSetOptions(hideableIds),
    onChoose,
  };
}
export interface ColumnSetSort {
  sort: string;
  descending: boolean;
}
/**
 * The visibility a set gives (decision D8): the set decides the metric columns, or shows every
 * column for `all`; identity columns keep their state.
 */
export function columnSetVisibility(
  set: ColumnSetId,
  current: Readonly<Record<string, boolean>>,
): Record<string, boolean> {
  const visible: Record<string, boolean> = { ...current };
  if (set === 'all')
    for (const id of [...Object.keys(visible), ...reportMetricIds]) visible[id] = true;
  else
    for (const id of reportMetricIds)
      visible[id] = (columnSetMetrics[set] as readonly string[]).includes(id);
  return visible;
}
/**
 * The columns and sort after choosing a set (decisions D8 and D9): the set's visibility. When the
 * set hides the sorted metric, the sort moves to the set's lead metric, descending (All credits:
 * the lens's default), or to Period ascending on Over time; the caller returns to page 1 then.
 * `sort` is absent when the sort does not change.
 */
export function columnSetChange(
  set: ColumnSetId,
  lens: ContributionLens,
  current: { visible: Readonly<Record<string, boolean>>; sort: ColumnSetSort },
  kind: 'report' | 'timeline',
): { visible: Record<string, boolean>; sort?: ColumnSetSort } {
  const visible = columnSetVisibility(set, current.visible);
  const sorted = current.sort.sort;
  if (!(reportMetricIds as readonly string[]).includes(sorted) || visible[sorted])
    return { visible };
  if (kind === 'timeline') return { visible, sort: { sort: 'period', descending: false } };
  const lead =
    lensDefaultSort[
      set === 'contributor' ? 'contributors' : set === 'reviewer' ? 'reviewers' : lens
    ];
  return { visible, sort: { sort: lead.sort, descending: lead.descending } };
}

const overviewLabels = {
  '/contributors': 'Back to Contributors',
  '/reviewers': 'Back to Reviewers',
  '/companies': 'Back to Companies',
} as const;
/**
 * A crumb's label (decision D12): an overview report without a metric or Over time is named,
 * "Back to Contributors", "Back to Reviewers" or "Back to Companies" (in any lens, the Companies
 * lens's /companies?lens=all included); any other parent, and an unavailable one (null), is
 * "Back to report".
 */
export function contributionBackLabel(parent: UrlView | null | undefined): string {
  if (
    parent &&
    parent.route in overviewLabels &&
    screenOf(parent.route, parent.values) === 'contributionOverview' &&
    parent.values.metric === undefined
  )
    return overviewLabels[parent.route as keyof typeof overviewLabels];
  return 'Back to report';
}
/**
 * Whether a Reviewers-lens report shows "No reviewer activity in this scope" (D19): every reviewer
 * credit total is a complete zero. A partial or missing total is the coverage notice's to explain.
 */
export function noReviewerActivity(totals: ContributionValues): boolean {
  return roleMetrics.reviewer.every(
    (metric) => totals[metric].status === 'complete' && totals[metric].value === 0,
  );
}
