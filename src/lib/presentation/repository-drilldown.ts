import { readRepositoryDrilldown } from './url/legacy/repository';
export { readRepositoryDrilldown };
import {
  drilldownSelectionSchema,
  repositoryDrilldownSchema,
  type DrilldownSelection,
  type RepositoryDrilldown,
} from '@/models/repository-drilldown';
import { activityMetricIds, type OverviewRepository } from '@/models/repository-overview';
import { parseQuery } from './url/codec';
import { recordKindOf } from './url/defaults';
import { encodeFrame, resolveBack, unavailableFrame, viewHref, type UrlView } from './url/back';
import { instantIso, periodRange, periodSelection, rangeValues } from './url/period';
import type { UrlValue, UrlValues } from './url/registry';

const periodMetrics: readonly string[] = [...activityMetricIds, 'medianMergeDays'];
const text = (value: UrlValue | undefined) => (typeof value === 'string' ? value : undefined);

/**
 * A drilldown selection as URL fields: its metric, then its period and snapshot or its age. A
 * record kind's default current list is its entry view (`?view=issues`, or nothing for open PRs).
 */
export function drilldownValues(selection: DrilldownSelection): Record<string, UrlValue> {
  if (selection.scope === 'current') {
    if (selection.metric === 'totalOpenPrs') return {};
    if (selection.metric === 'openIssues') return { view: 'issues' };
    return selection.metric === 'agedPrs'
      ? { metric: 'agedPrs', age: String(selection.ageDays) }
      : { metric: selection.metric };
  }
  const period = rangeValues(selection.range);
  if (!period) throw new Error('Invalid repository drilldown');
  return { metric: selection.metric, ...period };
}

/**
 * The drilldown a repository page's values select, or null when they name none the page can list:
 * an unknown metric, a period metric without a period, a current metric with one, or a view that
 * contradicts the metric. A period resolves against its snapshot, else the reporting as-of.
 */
export function readDrilldownSelection(
  values: UrlValues,
  repo: OverviewRepository,
  asOf: string,
): DrilldownSelection | null {
  const view = text(values.view),
    named = text(values.metric);
  if (view !== undefined && named !== undefined && recordKindOf({ metric: named }) !== view)
    return null;
  const metric = named ?? (view === 'issues' ? 'openIssues' : 'totalOpenPrs');
  const period = text(values.period),
    at = text(values.at),
    age = text(values.age);
  let input: Record<string, unknown>;
  if (periodMetrics.includes(metric)) {
    const selected = period === undefined ? null : periodSelection(period);
    const instant = at === undefined ? asOf : instantIso(at);
    const range = selected && instant && periodRange(selected, instant);
    if (!range || age !== undefined) return null;
    input = {
      scope: 'period',
      metric,
      range,
      ...(metric === 'prsMerged' || metric === 'medianMergeDays'
        ? { branch: repo.primaryBranch }
        : {}),
    };
  } else {
    if (period !== undefined || at !== undefined) return null;
    input =
      metric === 'agedPrs'
        ? { scope: 'current', metric, ageDays: Number(age) }
        : age === undefined
          ? { scope: 'current', metric }
          : { metric: '' };
  }
  const parsed = drilldownSelectionSchema.safeParse(input);
  return parsed.success ? parsed.data : null;
}

/** The Summary view a `returnTo` href names, or null when it is not a canonical Summary address. */
function summaryView(returnTo: string): UrlView | null {
  const url = new URL(returnTo, 'https://dashboard.invalid');
  if (url.pathname !== '/repos') return null;
  const parsed = parseQuery('/repos', url.search);
  return parsed.kind === 'canonical' && parsed.screen === 'summary'
    ? { route: '/repos', segments: {}, values: parsed.values }
    : null;
}
/**
 * The `back` frames for a repository list or insight that returns to a Summary: none for the
 * derived Summary (the v1 defaults), its differences otherwise, and the unavailable frame when the
 * Summary cannot be restored (null, or not a canonical Summary address).
 */
export function summaryBack(list: UrlView, returnTo: string | null): string[] {
  const parent = returnTo === null ? null : summaryView(returnTo);
  return [(parent && encodeFrame(list, parent)) ?? unavailableFrame];
}
/** A list one level down; its frames never fit only when its own values fill the URL cap. */
export function childHref(view: UrlView): string {
  const href = viewHref(view, 'child');
  if (href === null) throw new Error('This link is too large to open.');
  return href;
}
/**
 * A repository list or insight href: the selection, the target table's presentation (the viewer's
 * saved columns, sort and charts, decision C3), and a `back` frame for the Summary it came from.
 */
export function repositoryDrilldownHref(
  repo: OverviewRepository,
  input: RepositoryDrilldown,
  presentation: UrlValues = {},
): string {
  const { selection, returnTo } = repositoryDrilldownSchema.parse(input);
  if (
    selection.scope === 'period' &&
    selection.branch !== undefined &&
    selection.branch !== repo.primaryBranch
  )
    throw new Error('Invalid repository drilldown');
  const list: UrlView = {
    route: '/repos/[slug]',
    segments: { slug: [repo.slug] },
    values: { ...presentation, ...drilldownValues(selection) },
  };
  return childHref({ ...list, values: { ...list.values, back: summaryBack(list, returnTo) } });
}

/**
 * The Summary a repository page returns to: `/repos` when its address names no return context
 * (the crumb then opens the viewer's saved Summary), the restored Summary href when a frame names
 * one, and null when that Summary cannot be restored.
 */
export function summaryReturnTo(view: UrlView): string | null {
  if (view.values.back === undefined) return '/repos';
  const summary = resolveBack(view).find(
    (ancestor) => !ancestor.available || ancestor.view.route === '/repos',
  );
  return summary?.available ? summary.href : null;
}
