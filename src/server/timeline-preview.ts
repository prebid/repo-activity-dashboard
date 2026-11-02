import 'server-only';
import { z } from 'zod';
import { notFound } from 'next/navigation';
import { requireViewer } from '@/lib/auth/viewer';
import { repositoryCatalog } from '@/config/repositories';
import type { ContributionArea } from '@/models/contribution-page';
import type { ContributionFocus } from '@/models/contributions';
import type {
  TimelineArea,
  TimelineControlContext,
  TimelinePreferences,
} from '@/models/timeline-controls';
import type { ContributionDirectory, ContributionSettings } from '@/models/contribution-settings';
import type { SavedPreference } from '@/models/preferences';
import { contributionTimelineSample } from '@/mocks/contribution-timeline';
import {
  repositoryTimelineSample,
  repositoryTimelineMatrixSample,
} from '@/mocks/repository-timeline';
import { repositoryPageNavigationSample } from '@/mocks/repository-page';
import { contributionSampleAsOf } from '@/mocks/contributions';
import { selectContributionTimeline } from '@/lib/presentation/contribution-timeline';
import { selectRepositoryTimeline } from '@/lib/presentation/repository-timeline';
import {
  readContributionSettings,
  contributionScopeKeys,
  hasContributionScope,
} from '@/lib/presentation/contribution-settings';
import { contributionUrlFits } from '@/lib/presentation/contribution-return';
import { contributionPath } from '@/lib/presentation/contribution-navigation';
import {
  selectRepositoryTimelineMatrix,
  matrixRepositoryIds,
} from '@/lib/presentation/repository-timeline-matrix';
import { repositoryMatrixSummaryHref } from '@/lib/presentation/repository-timeline-matrix-entry';
import {
  readTimelineSource,
  readTimelineView,
  resolveTimelineEntry,
  timelinePreferenceSection,
  timelineViewKeys,
  validateTimelineScope,
} from '@/lib/presentation/timeline-controls';
import {
  savedContributionScope,
  savedTimelinePresentation,
  type PreferenceSnapshot,
} from './preferences';
import {
  contributionTimelineReportHref,
  safeTimelineParent,
} from '@/lib/presentation/timeline-navigation';
import { repositoryFilterOptions } from '@/lib/presentation/repository-page-filters';
import {
  repositoryTimelineMetricScope,
  type RepositoryTimelineMetric,
} from '@/models/repository-timeline';
import type { RepositoryPagePr, RepositoryPageIssue } from '@/models/repository-page';

const invalid = (message = 'The requested timeline view, date range or filters are invalid.') => ({
  status: 'invalid' as const,
  message,
});
const repositories = repositoryCatalog
  .filter((row) => row.enabled)
  .map((row) => ({
    id: row.id,
    slug: row.slug,
    name: row.displayName,
    primaryBranch: row.primaryBranch === 'main' ? ('main' as const) : ('master' as const),
  }));
function options(params: URLSearchParams, area: TimelineArea, path: string) {
  if (
    ['scope', 'population', 'view', 'nav', 'returnTo'].some((key) => params.getAll(key).length > 1)
  )
    return invalid();
  const allowed = new Set<string>([
    'timeline',
    ...timelineViewKeys,
    'timeline.gap',
    'timeline.omitted',
    'sample',
    'period',
    'from',
    'through',
    ...(area === 'matrix'
      ? ['repo', 'summary']
      : area === 'repository'
        ? ['timelineParent']
        : [...contributionScopeKeys, 'nav', 'returnTo', 'view', 'members.zero']),
  ]);
  if (
    !contributionUrlFits(path + '?' + params.toString()) ||
    [...params.keys()].some(
      (key) =>
        !allowed.has(key) &&
        !(area === 'repository' && /^(prs|issues)\.(q|filter\.[a-zA-Z]+)$/.test(key)) &&
        !(
          area === 'contribution' &&
          /^(report|contributors|companies|members|repositories|details)\.(q|sort|dir|page|columns)$/.test(
            key,
          )
        ),
    )
  )
    return invalid();
  const source = readTimelineSource(params, area);
  if (
    !source ||
    params.has('metric') ||
    params.getAll('timelineParent').length > 1 ||
    (params.has('timeline.omitted') && params.get('timeline.omitted') !== 'current')
  )
    return invalid();
  try {
    return {
      status: 'valid' as const,
      search: params.toString(),
      ...readTimelineView(params, area, contributionSampleAsOf),
      ...source,
    };
  } catch (error) {
    return invalid(
      error instanceof z.ZodError
        ? 'The requested timeline options are invalid.'
        : error instanceof Error
          ? error.message
          : undefined,
    );
  }
}
function context(
  area: TimelineArea,
  path: string,
  parsed: Extract<ReturnType<typeof options>, { status: 'valid' }>,
  preferenceScope: string,
): TimelineControlContext {
  return {
    area,
    path,
    href: path + '?' + parsed.search,
    sample: parsed.sample + (parsed.gap ? ':gap' : ''),
    asOf: contributionSampleAsOf,
    preferenceScope,
    period: parsed.period,
    exactRange: parsed.exactRange,
    view: parsed.view,
    metricIds: parsed.metricIds,
    repositories,
  };
}
/**
 * The saved-preference sections for one Timeline render. An entry, a URL without timeline.state,
 * resolves against them to a redirect to its explicit-state URL, or to the requested view with a
 * notice; an explicit-state URL never reads saved values. Without a snapshot nothing is saved.
 */
function timelinePreferences(
  params: URLSearchParams,
  controls: TimelineControlContext,
  snapshot: PreferenceSnapshot | undefined,
  directory?: ContributionDirectory,
): { redirect: string } | { preferences?: TimelinePreferences } {
  if (!snapshot) return {};
  const section = timelinePreferenceSection(controls.area, controls.preferenceScope);
  const unread = { binding: snapshot.binding, value: null };
  const entry = !params.has('timeline.state');
  const presentation: SavedPreference<string> = entry
    ? savedTimelinePresentation(snapshot, section, controls.area)
    : { section, ...unread };
  const consultScope = entry && !hasContributionScope(params);
  const scope: SavedPreference<ContributionSettings> | undefined =
    directory &&
    (consultScope
      ? savedContributionScope(snapshot, directory, controls.asOf)
      : { section: 'contributions.scope', ...unread });
  if (!entry) return { preferences: { presentation, scope } };
  const resolved = resolveTimelineEntry(params.toString(), controls, {
    presentation: presentation.invalid === undefined ? (presentation.value ?? '') : null,
    scope:
      !scope || !consultScope
        ? undefined
        : scope.invalid === undefined
          ? (scope.value ?? undefined)
          : null,
  });
  if (resolved.kind === 'redirect') return { redirect: controls.path + '?' + resolved.search };
  // Only the section a notice reports is deleted after hydration; the other was not consulted.
  const reported = <T>(saved: SavedPreference<T>, kind: 'presentation' | 'scope') =>
    resolved.rejected === kind
      ? saved
      : { section: saved.section, binding: saved.binding, value: saved.value };
  return {
    preferences: {
      presentation: reported(presentation, 'presentation'),
      scope: scope && reported(scope, 'scope'),
      notice: resolved.notice,
    },
  };
}
const redirectTo = (href: string) => ({ status: 'redirect' as const, href });
export async function contributionTimelinePreview(
  area: ContributionArea,
  params: URLSearchParams,
  focus: ContributionFocus = { kind: 'overview' },
  preferences?: PreferenceSnapshot,
) {
  const viewer = await requireViewer();
  const path = contributionPath(focus.kind === 'overview' ? area : focus),
    parsed = options(params, 'contribution', path);
  if (parsed.status === 'invalid') return parsed;
  if (parsed.sample === 'mixed') return invalid();
  const sample = contributionTimelineSample(parsed.sample, parsed.gap);
  const settings = readContributionSettings(
    params,
    sample.contributions,
    sample.contributions.asOf,
  );
  if (
    !settings ||
    (params.has('view') && !['members', 'repositories'].includes(params.get('view')!))
  )
    return invalid();
  if (
    (focus.kind === 'contributor' &&
      !sample.contributions.accounts.some((row) => row.id === focus.accountId)) ||
    (focus.kind === 'company' &&
      focus.companyId !== null &&
      !sample.contributions.companies.some((row) => row.id === focus.companyId))
  )
    notFound();
  const controls: TimelineControlContext = {
    ...context('contribution', path, parsed, area + ':' + focus.kind),
    contribution: settings,
  };
  const saved = timelinePreferences(params, controls, preferences, sample.contributions);
  if ('redirect' in saved) return redirectTo(saved.redirect);
  return {
    status: 'ready' as const,
    viewerId: viewer.id,
    report: selectContributionTimeline(sample, parsed.request, settings.selection, focus),
    reportHref: contributionTimelineReportHref(
      params,
      path,
      settings,
      sample.contributions,
      sample.contributions.asOf,
    ),
    href: path + '?' + params.toString(),
    controls: { ...controls, ...saved },
  };
}
export async function repositoryTimelinePreview(
  slug: string,
  params: URLSearchParams,
  preferences?: PreferenceSnapshot,
) {
  const viewer = await requireViewer();
  const repository = repositoryCatalog.find((row) => row.slug === slug && row.enabled);
  if (!repository) notFound();
  const path = '/repos/' + encodeURIComponent(slug),
    parsed = options(params, 'repository', path);
  if (parsed.status === 'invalid') return parsed;
  const parent = safeTimelineParent(params.get('timelineParent'), path);
  if (params.has('timelineParent') && !parent) return invalid();
  let filters;
  try {
    filters = validateTimelineScope(params, parsed, 'repository', repositories)!;
  } catch (error) {
    return invalid(error instanceof Error ? error.message : undefined);
  }
  const controls: TimelineControlContext = {
    ...context('repository', path, parsed, repository.id),
    filters,
  };
  const saved = timelinePreferences(params, controls, preferences);
  if ('redirect' in saved) return redirectTo(saved.redirect);
  const source = repositoryTimelineSample(
    parsed.view.kind,
    repository.id,
    parsed.sample,
    parsed.gap,
  );
  const rows = [
    ...source.rows,
    ...source.snapshots.flatMap<RepositoryPagePr | RepositoryPageIssue>(
      (snapshot) => snapshot.rows,
    ),
  ];
  return {
    status: 'ready' as const,
    viewerId: viewer.id,
    report: selectRepositoryTimeline(source, parsed.request, parsed.view.family, filters),
    navigation: repositoryPageNavigationSample(source.repository),
    href: path + '?' + params.toString(),
    parent,
    omitted: params.get('timeline.omitted') === 'current',
    facets: repositoryFilterOptions(rows),
    controls: { ...controls, ...saved },
  };
}
export async function repositoryTimelineMatrixPreview(
  params: URLSearchParams,
  preferences?: PreferenceSnapshot,
) {
  const viewer = await requireViewer(),
    parsed = options(params, 'matrix', '/repos');
  if (parsed.status === 'invalid') return parsed;
  const summaryHref = repositoryMatrixSummaryHref(params.get('summary'));
  if (summaryHref === null || params.getAll('summary').length > 1) return invalid();
  try {
    validateTimelineScope(params, parsed, 'matrix', repositories);
  } catch (error) {
    return invalid(error instanceof Error ? error.message : undefined);
  }
  const repositoryIds = matrixRepositoryIds(
    params,
    repositories.map((row) => row.id),
  );
  const controls: TimelineControlContext = {
    ...context('matrix', '/repos', parsed, 'matrix'),
    repositoryIds,
  };
  const saved = timelinePreferences(params, controls, preferences);
  if ('redirect' in saved) return redirectTo(saved.redirect);
  const kinds = new Set(
    parsed.metricIds.map(
      (metric) => repositoryTimelineMetricScope(metric as RepositoryTimelineMetric).recordKind,
    ),
  );
  const source = repositoryTimelineMatrixSample(
    kinds.size > 1 ? 'mixed' : kinds.has('issues') ? 'issues' : 'prs',
    parsed.sample,
    parsed.gap,
  );
  // validateTimelineScope applied the matrix size rule above to these same inputs.
  return {
    status: 'ready' as const,
    viewerId: viewer.id,
    matrix: selectRepositoryTimelineMatrix(source, parsed.request, {
      repositoryIds,
      metrics: parsed.metricIds as RepositoryTimelineMetric[],
    }),
    href: '/repos?' + params.toString(),
    summaryHref,
    controls: { ...controls, ...saved },
  };
}
