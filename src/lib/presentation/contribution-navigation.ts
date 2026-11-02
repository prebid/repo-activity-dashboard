export { companyFocus, readContributionLayoutQuery } from './url/legacy/contribution';
import type { ContributionContext } from '@/models/contributions';
import type { ReportMetric } from '@/models/contribution-metrics';
import type { ContributionSettings } from '@/models/contribution-settings';
import {
  type ContributionArea,
  type ContributionSampleScenario,
  type CompanyBreakdown,
} from '@/models/contribution-page';
import type { ContributionFocus } from '@/models/contributions';
import type { ContributionLens } from '@/models/contribution-lens';
import { contributionUrlFits } from './contribution-return';
import { urlHref } from './url/codec';
import { viewHref, type UrlView } from './url/back';
import {
  childViewHref,
  contributionLensValues,
  contributionScopeValues,
  contributionTarget,
  contributionViewOf,
  levelViewHref,
  omitValues,
  savedPresentationValues,
  type ContributionTarget,
  type SavedContributionTables,
} from './contribution-url';

/** A target's path; the people overview's is /reviewers in the Reviewers lens. */
export function contributionPath(
  target: ContributionTarget,
  lens: ContributionLens = 'contributors',
): string {
  if (typeof target === 'string')
    return target === 'contributors' && lens === 'reviewers' ? '/reviewers' : '/' + target;
  if (target.kind === 'contributor') return '/contributors/' + encodeURIComponent(target.accountId);
  return target.companyId === null
    ? '/companies/unmapped'
    : '/companies/id/' + encodeURIComponent(target.companyId);
}
/**
 * A target's view at a scope in a lens, with its table's saved presentation (decision C3); `saved`
 * holds that lens's tables.
 */
function targetView(
  target: ContributionTarget,
  sample: ContributionSampleScenario,
  settings: ContributionSettings | undefined,
  saved: SavedContributionTables | undefined,
  lens: ContributionLens,
  extra: Record<string, string> = {},
): UrlView {
  const { route, segments } = contributionTarget(target, lens);
  const values = {
    ...contributionLensValues(route, lens),
    ...(sample !== 'reference' && { sample }),
    ...(settings && contributionScopeValues(settings)),
    ...extra,
  };
  return {
    route,
    segments,
    values: { ...values, ...savedPresentationValues(route, values, saved) },
  };
}
/**
 * A link to a contribution report at a scope, in a lens (the people overview is /reviewers in the
 * Reviewers lens; every other route carries `lens=reviewers`). From a report (`returnTo`, its
 * canonical href) the link carries that report as its parent frame; without one it is a same-level
 * link written in explicit form, so it never answers with a saved view. Null when it does not fit.
 */
export function contributionHref(
  target: ContributionTarget,
  sample: ContributionSampleScenario,
  returnTo?: string,
  settings?: ContributionSettings,
  saved?: SavedContributionTables,
  lens: ContributionLens = 'contributors',
): string | null {
  const child = targetView(target, sample, settings, saved, lens);
  if (returnTo === undefined) {
    const href = urlHref(child.route, child.segments, child.values, { explicit: true });
    return contributionUrlFits(href) ? href : null;
  }
  const parent = contributionViewOf(returnTo);
  return parent ? childViewHref(parent, child) : viewHref(child, 'child');
}
export const companyBreakdownLabels: Record<CompanyBreakdown, string> = {
  members: 'By contributor',
  repositories: 'By repository',
};
/**
 * A company report's other breakdown (`search` is its canonical query): the same scope and parent,
 * with that table's saved presentation in place of the current table's search, sort, page and
 * columns. The page itself when the address would exceed the URL cap.
 */
export function companyBreakdownHref(
  path: string,
  search: string,
  view: CompanyBreakdown,
  saved?: SavedContributionTables,
): string {
  const query = search.replace(/^\?/, '');
  const here = path + (query ? '?' + query : '');
  const current = contributionViewOf(here);
  if (!current) return here;
  const values = omitValues(current.values, ['view', 'q', 'sort', 'page', 'cols', 'zero', 'v']);
  if (view === 'repositories') values.view = 'repositories';
  return (
    levelViewHref(current, {
      ...current,
      values: { ...values, ...savedPresentationValues(current.route, values, saved) },
    }) ?? here
  );
}

/**
 * A metric's supporting records for a report subject at the report's scope, optionally narrowed to
 * one repository, from the report the value was clicked on (`returnTo`), in a lens.
 */
export function contributionMetricHref(
  target: ContributionTarget,
  sample: ContributionSampleScenario,
  context: ContributionContext,
  metric: ReportMetric,
  returnTo: string,
  repositoryId?: string,
  saved?: SavedContributionTables,
  lens: ContributionLens = 'contributors',
): string | null {
  const settings = {
    period: context.period,
    selection: { ...context.selection, ...(repositoryId ? { repositoryIds: [repositoryId] } : {}) },
  };
  const child = targetView(target, sample, settings, saved, lens, { metric });
  const parent = contributionViewOf(returnTo);
  return parent ? childViewHref(parent, child) : viewHref(child, 'child');
}
/** The report target a focus names; an overview opens its area. */
export function contributionTargetOf(
  area: ContributionArea,
  focus: ContributionFocus,
): ContributionTarget {
  return focus.kind === 'overview' ? area : focus;
}
