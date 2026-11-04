// The frozen v1 URL defaults. An absent field means its v1 default, never a saved preference, so
// these values must not change: a later default is a new version (`v=2`) with its own table. A key
// may be added for a value that was invalid before; an existing value never changes. The Companies
// lens (`lens=all`, P7) added `lensMetricColumns.all` and `contributions.sort.all` this way.
import { repositoryCatalog } from '@/config/repositories';
import { insightMetrics } from '@/models/repository-insights';
import { backlogMetricIds } from '@/models/repository-overview';
import { repositoryTimelineFamilyMetrics } from '@/models/repository-timeline';
import {
  contributionMetricBasis,
  isReportMetric,
  reportMetricIds,
} from '@/models/contribution-metrics';
import {
  contributionDetailColumnIds,
  contributionTableColumnIds,
  recordIssueColumnIds,
  recordPrColumnIds,
} from '@/models/table-columns';
import {
  screenOf,
  timelineScreen,
  urlParams,
  type UrlRoute,
  type UrlScreen,
  type UrlValue,
  type UrlValues,
} from './registry';

const supportOnly: ReadonlySet<string> = new Set(
  urlParams
    .filter((entry) => entry.screens.length === 1 && entry.screens[0] === 'support')
    .map((entry) => entry.name)
    .concat(['listq', 'listsort', 'listpage']),
);

export const urlVersion = '1';

/**
 * Contribution lenses' default metric columns: each role lens shows its three credits (decision
 * C5); the Companies lens shows the six credits in report order.
 */
export const lensMetricColumns = {
  contributors: ['prsAuthored', 'authoredPrsMerged', 'issuesAuthored'],
  reviewers: ['reviewerContributions', 'approvalContributions', 'mergesPerformed'],
  all: [
    'prsAuthored',
    'authoredPrsMerged',
    'reviewerContributions',
    'approvalContributions',
    'mergesPerformed',
    'issuesAuthored',
  ],
} as const;
export type UrlLens = keyof typeof lensMetricColumns;

/** The v1 table. Values that depend on other fields are keyed by the field they depend on. */
export const urlDefaultsV1 = {
  sample: 'reference',
  lens: 'contributors',
  view: { repository: 'prs', company: 'members' },
  group: 'month',
  family: 'activity',
  origin: 'timeline',
  page: '1',
  period: { summary: 'this-month', report: 'this-year' },
  summary: { age: ['30'], bsort: '-totalOpenPrs', asort: '-prsOpened' },
  matrix: { metric: ['prsOpened'], sort: 'repository' },
  records: { metric: { prs: 'totalOpenPrs', issues: 'openIssues' }, sort: '-createdAt' },
  insightSort: {
    prAuthors: '-recordCount',
    issueAuthors: '-recordCount',
    medianMergeDays: '-createdAt',
    credits: '-firstCreditAt',
  },
  repositoryTimeline: {
    metric: {
      'prs.activity': 'prsOpened',
      'prs.snapshot': 'totalOpenPrs',
      'issues.activity': 'issuesOpened',
      'issues.snapshot': 'openIssues',
    },
    sort: 'period',
    // Snapshot metrics shown by default; every activity metric is shown.
    snapshotColumns: [
      'totalOpenPrs',
      'draftPrs',
      'nonDraftPrs',
      'openIssues',
      'humanApprovals0',
      'humanApprovals1',
      'humanApprovals2',
    ],
  },
  contributionTimeline: { sort: 'period' },
  contributions: {
    sort: {
      contributors: '-authoredPrsMerged',
      reviewers: '-reviewerContributions',
      all: '-authoredPrsMerged',
    },
    detailsSort: '-creditedAt',
    identityColumns: {
      contributors: ['name', 'actorType', 'company'],
      companies: ['name', 'members'],
      members: ['name', 'actorType'],
      repositories: ['name'],
    },
    lensMetricColumns,
  },
  actorTypes: ['human', 'agent', 'bot', 'unknown'],
} as const;

/** Every enabled repository in catalog order: what an absent `repo` means. */
export function allRepositorySlugs(): readonly string[] {
  return repositoryCatalog.filter((row) => row.enabled).map((row) => row.slug);
}

const str = (value: UrlValue | undefined) => (typeof value === 'string' ? value : undefined);
/** The lens a screen's values select; the route decides for `/reviewers`. */
export function lensOf(route: UrlRoute, values: UrlValues): UrlLens {
  if (route === '/reviewers' || values.lens === 'reviewers') return 'reviewers';
  return values.lens === 'all' ? 'all' : 'contributors';
}
/** The record kind of a repository record list: the metric's kind, else the `view`. */
export function recordKindOf(values: UrlValues): 'prs' | 'issues' {
  const metric = str(values.metric);
  if (metric !== undefined)
    return metric === 'openIssues' || /^issue/.test(metric) ? 'issues' : 'prs';
  return values.view === 'issues' ? 'issues' : 'prs';
}
function sortDefault(route: UrlRoute, screen: UrlScreen, values: UrlValues): string | undefined {
  const metric = str(values.metric);
  switch (screen) {
    case 'records':
    case 'authorRecords':
      return urlDefaultsV1.records.sort;
    case 'insight':
      return metric === 'prAuthors' || metric === 'issueAuthors' || metric === 'medianMergeDays'
        ? urlDefaultsV1.insightSort[metric]
        : urlDefaultsV1.insightSort.credits;
    case 'matrix':
      return urlDefaultsV1.matrix.sort;
    case 'repositoryTimeline':
    case 'contributionTimeline':
      return urlDefaultsV1.repositoryTimeline.sort;
    case 'contributionOverview':
    case 'contributionDetail':
      return metric !== undefined
        ? urlDefaultsV1.contributions.detailsSort
        : urlDefaultsV1.contributions.sort[lensOf(route, values)];
    case 'export':
      return urlDefaultsV1.contributions.sort[lensOf(route, values)];
    default:
      return undefined;
  }
}
function metricDefault(screen: UrlScreen, values: UrlValues): UrlValue | undefined {
  if (screen === 'matrix') return urlDefaultsV1.matrix.metric;
  if (screen === 'records')
    return urlDefaultsV1.records.metric[recordKindOf({ view: values.view ?? 'prs' })];
  if (screen !== 'repositoryTimeline') return undefined;
  const kind = values.view === 'issues' ? 'issues' : 'prs';
  const family = values.family === 'snapshot' ? 'snapshot' : 'activity';
  return urlDefaultsV1.repositoryTimeline.metric[`${kind}.${family}`];
}

/**
 * The v1 default of a field on a screen, given the screen's other values; undefined when an absent
 * field means "none" (a flag off, no filter, no drilldown) or when the default depends on data the
 * codec does not hold (the matrix's last `window`). Writers omit a field equal to its default.
 */
export function defaultValue(
  route: UrlRoute,
  name: string,
  values: UrlValues,
  requested: UrlScreen = screenOf(route, values),
): UrlValue | undefined {
  // A supporting view keeps its Timeline's fields, with that Timeline's defaults.
  const screen =
    requested === 'support' && !supportOnly.has(name) ? timelineScreen(route) : requested;
  switch (name) {
    case 'sample':
      return urlDefaultsV1.sample;
    case 'lens':
      return urlDefaultsV1.lens;
    case 'view':
      return route.startsWith('/repos')
        ? urlDefaultsV1.view.repository
        : urlDefaultsV1.view.company;
    case 'group':
      return urlDefaultsV1.group;
    case 'family':
      return urlDefaultsV1.family;
    case 'origin':
      return urlDefaultsV1.origin;
    case 'page':
    case 'bpage':
    case 'apage':
    case 'listpage':
    case 'dpage':
      return urlDefaultsV1.page;
    case 'period':
      return screen === 'summary'
        ? urlDefaultsV1.period.summary
        : ['records', 'insight', 'authorRecords'].includes(screen)
          ? undefined
          : urlDefaultsV1.period.report;
    case 'age':
      return screen === 'summary' ? urlDefaultsV1.summary.age : undefined;
    case 'repo':
      return allRepositorySlugs();
    case 'type':
      return urlDefaultsV1.actorTypes;
    case 'bsort':
      return urlDefaultsV1.summary.bsort;
    case 'asort':
      return urlDefaultsV1.summary.asort;
    case 'sort':
      return sortDefault(route, screen, values);
    case 'metric':
      return metricDefault(screen, values);
    case 'rank': {
      const metrics = values.metric ?? urlDefaultsV1.matrix.metric;
      return typeof metrics === 'object' ? metrics[0] : undefined;
    }
    case 'cols':
    case 'dcols':
      return [];
    case 'v':
      return urlVersion;
    default:
      return undefined;
  }
}

/** A table's column IDs in order and the ones v1 shows; `cols` is a diff against them. */
export interface UrlColumnTable {
  readonly ids: readonly string[];
  readonly visible: ReadonlySet<string>;
}
const isBacklogMetric = (metric: string) =>
  metric === 'agedPrs' || (backlogMetricIds as readonly string[]).includes(metric);
/**
 * v1 record-list columns for a drilldown metric: the reviewed defaults the record pages show
 * (`repositoryRecordColumnDefaults`), frozen here. An author's own list hides its Author column.
 */
export function recordColumnTable(
  kind: 'prs' | 'issues',
  metric: string,
  authorScoped = false,
): UrlColumnTable {
  const current = isBacklogMetric(metric),
    merged = metric === 'prsMerged' || metric === 'medianMergeDays';
  const hidden: Record<string, boolean> = {
    author: authorScoped,
    labels: true,
    state: true,
    authorType: true,
    createdAt: current,
    ageDays: !current,
    humanReviewers: !(
      (current && ['totalOpenPrs', 'nonDraftPrs'].includes(metric)) ||
      metric.startsWith('humanReviewers')
    ),
    approvals: !(
      (current && ['totalOpenPrs', 'nonDraftPrs'].includes(metric)) ||
      metric.startsWith('humanApprovals')
    ),
    mergedAt: !merged,
    mergeDays: !merged,
    baseBranch: !merged,
    closedAt: metric !== 'issuesClosed',
    agentReviewer: metric !== 'agentFeedbackPrs',
    botReviewer: metric !== 'botFeedbackPrs',
    latestActor: true,
    latestActivity: !current,
    assignees: true,
  };
  const ids = kind === 'prs' ? recordPrColumnIds : recordIssueColumnIds;
  return { ids, visible: new Set(ids.filter((id) => !hidden[id])) };
}
/** v1 contribution report table columns: identity columns and the lens's metrics (C5). */
export function contributionColumnTable(
  table: keyof typeof contributionTableColumnIds,
  lens: UrlLens,
): UrlColumnTable {
  return {
    ids: contributionTableColumnIds[table],
    visible: new Set([
      ...urlDefaultsV1.contributions.identityColumns[table],
      ...lensMetricColumns[lens],
    ]),
  };
}
/** v1 supporting-details columns: Last activity only for comment metrics. */
export function contributionDetailColumnTable(metric: string): UrlColumnTable {
  const comments = isReportMetric(metric) && contributionMetricBasis(metric) === 'comments';
  return {
    ids: contributionDetailColumnIds,
    visible: new Set(contributionDetailColumnIds.filter((id) => comments || id !== 'lastAt')),
  };
}
/** v1 repository Timeline metric columns for a record kind and family. */
export function repositoryTimelineColumnTable(
  kind: 'prs' | 'issues',
  family: 'activity' | 'snapshot',
): UrlColumnTable {
  const ids = repositoryTimelineFamilyMetrics(kind, family);
  const shown: readonly string[] = urlDefaultsV1.repositoryTimeline.snapshotColumns;
  return {
    ids,
    visible: new Set(ids.filter((id) => family === 'activity' || shown.includes(id))),
  };
}
/** v1 contribution Timeline metric columns: the lens's metrics (C5). */
export function contributionTimelineColumnTable(lens: UrlLens): UrlColumnTable {
  return { ids: reportMetricIds, visible: new Set(lensMetricColumns[lens]) };
}
/** The contribution table a report screen shows for its route and values. */
export function contributionTableOf(
  route: UrlRoute,
  values: UrlValues,
): keyof typeof contributionTableColumnIds | 'details' {
  if (values.metric !== undefined) return 'details';
  if (route === '/companies') return 'companies';
  if (route === '/contributors' || route === '/reviewers') return 'contributors';
  if (route === '/contributors/[accountId]') return 'repositories';
  return values.view === 'repositories' ? 'repositories' : 'members';
}
/**
 * The table a screen's `cols` field diffs against, or null when the screen's columns are not a URL
 * field the codec can resolve on its own (insight and supporting tables, the Summary).
 */
export function columnTableOf(route: UrlRoute, values: UrlValues): UrlColumnTable | null {
  const screen = screenOf(route, values);
  const metric = str(values.metric);
  switch (screen) {
    case 'records':
      return recordColumnTable(
        recordKindOf(values),
        metric ?? urlDefaultsV1.records.metric[recordKindOf(values)],
      );
    case 'authorRecords':
      return metric === 'prAuthors' || metric === 'issueAuthors'
        ? recordColumnTable(
            metric === 'prAuthors' ? 'prs' : 'issues',
            metric === 'prAuthors' ? 'prsOpened' : 'issuesOpened',
            true,
          )
        : null;
    case 'repositoryTimeline':
      return repositoryTimelineColumnTable(
        values.view === 'issues' ? 'issues' : 'prs',
        values.family === 'snapshot' ? 'snapshot' : 'activity',
      );
    case 'contributionTimeline':
      return contributionTimelineColumnTable(lensOf(route, values));
    case 'contributionOverview':
    case 'contributionDetail': {
      const table = contributionTableOf(route, values);
      return table === 'details'
        ? contributionDetailColumnTable(metric!)
        : contributionColumnTable(table, lensOf(route, values));
    }
    default:
      return null;
  }
}
/** `cols` tokens for the visible columns: shown-by-choice `id`, hidden-by-choice `-id`. */
export function columnTokens(table: UrlColumnTable, visible: Iterable<string>): string[] {
  const shown = new Set(visible);
  return table.ids.flatMap((id) =>
    shown.has(id) === table.visible.has(id) ? [] : [shown.has(id) ? id : '-' + id],
  );
}
/** The visible columns `cols` tokens describe, in table order; null for an unknown column. */
export function visibleColumns(table: UrlColumnTable, tokens: readonly string[]): string[] | null {
  const shown = new Set(table.visible);
  for (const token of tokens) {
    const id = token.startsWith('-') ? token.slice(1) : token;
    if (!table.ids.includes(id)) return null;
    if (token.startsWith('-')) shown.delete(id);
    else shown.add(id);
  }
  return table.ids.filter((id) => shown.has(id));
}
/** Whether a repository drilldown metric is a period insight (authors, credits, merge time). */
export function isInsightMetric(metric: string): boolean {
  return (insightMetrics as readonly string[]).includes(metric);
}
