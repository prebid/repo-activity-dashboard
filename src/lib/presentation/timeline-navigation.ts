// Links into Timelines: a repository's Timeline from its lists, insights, author pages and the
// matrix. Each carries the page it was opened from as its `back` frame (P5d); a repository
// Timeline has no parent it could derive.
import { currentReviewFilterKeys, withoutCurrentReviewFilters } from './repository-page-rules';
import { repositoryFilterFields } from './repository-page-query';
import type { RepositoryPageSource, RepositoryPageFilters } from '@/models/repository-page';
import type { TimelineControlContext } from '@/models/timeline-controls';
import type { RepositoryDrilldown } from '@/models/repository-drilldown';
import {
  repositoryTimelineFamilyMetrics,
  repositoryTimelineMetricSchema,
  repositoryTimelineMetricScope,
} from '@/models/repository-timeline';
import { childViewHref, viewOf, type UrlView } from './url/back';
import { savedTimelineLink } from './url/legacy/timeline-state';
import { urlHref } from './url/codec';
import { instantIso, rangeValues } from './url/period';
import type { UrlValue } from './url/registry';

const route = '/repos/[slug]' as const;
const defined = (values: Record<string, UrlValue | undefined>) =>
  Object.fromEntries(Object.entries(values).filter(([, value]) => value !== undefined)) as Record<
    string,
    UrlValue
  >;

/** A repository's Timeline for its record kind, with no list state to carry. */
export function repositoryTimelineHref(slug: string, kind: 'prs' | 'issues') {
  return urlHref(
    route,
    { slug: [slug] },
    kind === 'issues'
      ? { timeline: true, view: kind }
      : {
          timeline: true,
        },
  );
}
/**
 * The repository Timeline a list, insight or author page opens (`currentHref`, its canonical
 * href): the list's compatible filters and kind, its period as a period and snapshot, and the
 * page as the Timeline's parent. Null when the filters do not carry over or the link cannot fit.
 */
export function repositoryTimelineEntry(
  source: Pick<RepositoryPageSource, 'repository' | 'kind' | 'author'> & {
    drilldown: RepositoryDrilldown;
  },
  filters: RepositoryPageFilters,
  currentHref: string,
  /** The viewer's saved repository Timeline presentation (decision C3). */
  saved: string | null = null,
  asOf = '',
): string | null {
  const parent = viewOf(currentHref);
  if (
    !parent ||
    parent.segments.slug?.[0] !== source.repository.slug ||
    filters.kind !== source.kind ||
    (source.author &&
      filters.authors.length > 0 &&
      !filters.authors.includes(source.author.account))
  )
    return null;
  const next = withoutCurrentReviewFilters(filters);
  const { selection } = source.drilldown;
  const omitted =
    (selection.scope === 'current' && !['totalOpenPrs', 'openIssues'].includes(selection.metric)) ||
    filters.ageBand !== undefined ||
    (filters.kind === 'prs' && currentReviewFilterKeys.some((key) => filters[key] !== undefined));
  next.ageBand = undefined;
  next.eventRange = undefined;
  if (source.author) next.authors = [source.author.account];
  const range = filters.eventRange ?? (selection.scope === 'period' ? selection.range : null);
  const period = range ? rangeValues(range) : null;
  if (range && !period) return null;
  const metric =
    selection.scope === 'period' &&
    repositoryTimelineFamilyMetrics(source.kind, 'activity').some((id) => id === selection.metric)
      ? selection.metric
      : undefined;
  // Event ranges do not carry over, so no filter resolves against this instant.
  const at = (period && instantIso(period.at)) ?? '';
  const values = defined({
    timeline: true,
    view: source.kind === 'issues' ? 'issues' : undefined,
    ...period,
    metric,
    ...repositoryFilterFields(next, at),
    omitted: omitted || undefined,
  });
  // The list names the Timeline's records, family and period; its other presentation is saved.
  const explicit = ['view', 'family', 'period', ...(metric ? ['metric'] : [])];
  const child: UrlView = {
    route,
    segments: { slug: [source.repository.slug] },
    values: savedTimelineLink(route, values, explicit, saved, asOf),
  };
  return childViewHref(parent, child);
}
/**
 * A repository's Timeline from the matrix (`currentHref`, the matrix's canonical href): the
 * matrix's period, grouping and data source, the metric's record kind and family, and the matrix
 * as the Timeline's parent. Null when the link cannot fit.
 */
export function matrixRepositoryTimelineHref(
  context: Pick<TimelineControlContext, 'view'> & { asOf?: string },
  slug: string,
  currentHref: string,
  metric = context.view.metric,
  /** The viewer's saved repository Timeline presentation (decision C3). */
  saved: string | null = null,
) {
  const matrix = viewOf(currentHref);
  if (!matrix || matrix.route !== '/repos') return null;
  const selected = repositoryTimelineMetricSchema.parse(metric),
    scope = repositoryTimelineMetricScope(selected);
  const { values } = matrix;
  const own = defined({
    timeline: true,
    view: scope.recordKind,
    sample: values.sample,
    gap: values.gap,
    period: values.period,
    at: values.at,
    family: scope.family,
    metric: selected,
    group: values.group,
  });
  // The matrix names the metric, its period and grouping; chart and columns may be saved.
  const explicit = ['view', 'family', 'metric', 'period', 'group', 'sort', 'page'];
  const child: UrlView = {
    route,
    segments: { slug: [slug] },
    values: savedTimelineLink(route, own, explicit, saved, context.asOf ?? ''),
  };
  return childViewHref(matrix, child);
}
