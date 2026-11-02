// Timeline supporting views: one cell's records under its Timeline. A supporting view inherits its
// Timeline's values and `back` frames and adds `detail`, `interval`, `snap` and `origin`; its
// table keeps `dq`/`dsort`/`dpage`/`dcols`, and an author's records keep the authors list in
// `listq`/`listsort`/`listpage`.
export {
  readTimelineSupportQuery,
  timelineParentQuery,
  timelineSupportValueLimit,
} from './url/legacy/timeline';
import type { TimelineSourceIdentity } from '@/models/reporting-timeline';
import { viewHref, viewOf, type UrlView } from './url/back';
import { serializeQuery } from './url/codec';
import { instantValue } from './url/period';
import { routePath, screenOf, type UrlValue } from './url/registry';
import { timelineParentValues } from './url/timeline';

const recordTable = ['dq', 'dsort', 'dpage', 'dcols'];
const authorList = ['listq', 'listsort', 'listpage'];
const without = (values: Readonly<Record<string, UrlValue>>, names: readonly string[]) =>
  Object.fromEntries(Object.entries(values).filter(([name]) => !names.includes(name)));

/** What a supporting view shows, without its tables' search, sort, page and columns. */
export function timelineSupportScopeKey(href: string) {
  const view = viewOf(href);
  if (!view) return href;
  return (
    routePath(view.route, view.segments) +
    '?' +
    serializeQuery(view.route, without(view.values, [...recordTable, ...authorList]))
  );
}
/** An interval ID (`<grouping>:<ISO instant>`) as the `interval` value. */
function intervalValue(interval: string): string | null {
  const split = interval.indexOf(':');
  if (split < 1) return null;
  try {
    return interval.slice(0, split) + ':' + instantValue(interval.slice(split + 1));
  } catch {
    return null;
  }
}
/**
 * One Timeline cell's supporting records, from the Timeline's canonical href. Null for another
 * href or when the link cannot fit.
 */
export function timelineSupportHref(
  parent: string,
  source: TimelineSourceIdentity,
  metric: string,
  interval: string,
  origin: 'timeline' | 'matrix' = 'timeline',
) {
  const timeline = viewOf(parent);
  const value = intervalValue(interval);
  if (!timeline || value === null || timeline.values.timeline !== true) return null;
  const view: UrlView = {
    ...timeline,
    values: {
      ...timelineParentValues(timeline.values),
      detail: metric,
      interval: value,
      snap: source.scenarioId + '@' + instantValue(source.asOf),
      ...(origin === 'matrix' && { origin }),
    },
  };
  return screenOf(view.route, view.values) === 'support' ? viewHref(view, 'level') : null;
}
/** An author's records from the supporting authors list, or the list from them (`author` null). */
export function timelineAuthorHref(href: string, author: string | null) {
  const view = viewOf(href);
  if (!view) return null;
  const values = without(view.values, ['author', ...recordTable]);
  return viewHref({ ...view, values: author === null ? values : { ...values, author } }, 'level');
}
