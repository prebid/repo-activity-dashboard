import type { RepositoryPageSource } from '@/models/repository-page';
import { repositoryPageFiltersSchema } from '@/models/repository-page';
import type { DrilldownSelection } from '@/models/repository-drilldown';
import { periodPresets, type DateRange, type ResolvedPeriod } from '@/models/reporting-period';
import { customPeriodForRange, resolveReportingPeriod } from './reporting-period';
import { withoutCurrentReviewFilters } from './repository-page-rules';
import { drilldownValues } from './repository-drilldown';
import {
  defaultRepositoryFilters,
  readRepositoryFilters,
  repositoryFilterFields,
  repositoryFilterNames,
} from './repository-page-query';
import { mergeValues, recordColumnField } from './repository-url';
import { columnTableOf } from './url/defaults';
import { instantIso } from './url/period';
import type { UrlValue, UrlValues } from './url/registry';

export type RepositoryActivityMode = 'current' | 'created' | 'completed';
export function repositoryActivityMode(source: RepositoryPageSource): RepositoryActivityMode {
  const selection = source.drilldown.selection;
  return selection.scope === 'current'
    ? 'current'
    : ['prsMerged', 'issuesClosed'].includes(selection.metric)
      ? 'completed'
      : 'created';
}
export function repositoryActivityPeriod(source: RepositoryPageSource): ResolvedPeriod {
  const selection = source.drilldown.selection;
  if (selection.scope === 'current')
    return resolveReportingPeriod({ kind: 'preset', preset: 'this-month' }, source.asOf);
  for (const preset of periodPresets) {
    const period = resolveReportingPeriod({ kind: 'preset', preset }, source.asOf);
    if (JSON.stringify(period.range) === JSON.stringify(selection.range)) return period;
  }
  const range = selection.range;
  return {
    selection: customPeriodForRange(range),
    range,
    comparison: range,
    timezone: 'UTC',
  };
}
/** The instant a record list's values pin: its snapshot, else the reporting as-of. */
export function repositoryValuesAt(values: UrlValues, asOf: string): string {
  return typeof values.at === 'string' ? (instantIso(values.at) ?? asOf) : asOf;
}
/**
 * The values after a deliberate scope change: the new selection, with compatible filters, the
 * table's search and sort, chosen columns and the charts kept, starting on page one. The return
 * context stays: the Summary a list came from does not depend on its scope.
 */
export function repositoryScopeValues(
  source: RepositoryPageSource,
  mode: RepositoryActivityMode,
  range: DateRange,
  values: UrlValues,
  columns: Readonly<Record<string, boolean>>,
): Record<string, UrlValue> {
  const metric =
    source.kind === 'prs'
      ? mode === 'created'
        ? 'prsOpened'
        : 'prsMerged'
      : mode === 'created'
        ? 'issuesOpened'
        : 'issuesClosed';
  const selection: DrilldownSelection =
    mode === 'current'
      ? { scope: 'current', metric: source.kind === 'prs' ? 'totalOpenPrs' : 'openIssues' }
      : {
          scope: 'period',
          metric,
          range,
          ...(metric === 'prsMerged' ? { branch: source.repository.primaryBranch } : {}),
        };
  const cleared = Object.fromEntries(
    ['metric', 'view', 'period', 'at', 'age', 'page', ...repositoryFilterNames].map((name) => [
      name,
      undefined,
    ]),
  );
  const next = mergeValues(values, { ...cleared, ...drilldownValues(selection) });
  const filters =
    readRepositoryFilters(values, source, repositoryValuesAt(values, source.asOf)) ??
    defaultRepositoryFilters(source.kind);
  const compatible = mode === 'current' ? { ...filters } : withoutCurrentReviewFilters(filters);
  compatible.eventRange = undefined;
  if (mode === 'current') compatible.states = [];
  else compatible.ageBand = undefined;
  if (mode === 'completed' && compatible.kind === 'prs') {
    // Merged PRs already imply non-draft, Merged state and the configured primary branch.
    compatible.states = [];
    compatible.branches = [];
    compatible.draft = 'all';
  }
  return mergeValues(next, {
    ...repositoryFilterFields(
      repositoryPageFiltersSchema.parse(compatible),
      repositoryValuesAt(next, source.asOf),
    ),
    // Columns a viewer chose stay as they are; otherwise the new scope shows its own defaults.
    cols:
      values.cols === undefined
        ? undefined
        : recordColumnField(columnTableOf('/repos/[slug]', next)!, columns),
  });
}
