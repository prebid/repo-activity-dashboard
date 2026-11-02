import 'server-only';
import {
  readPreferences,
  savedOverviewSettings,
  savedPreference,
  savedTableSort,
  type PreferenceSnapshot,
  type SavedTableSort,
} from '@/server/preferences';
import type { PreferenceSectionKey, SavedPreference } from '@/models/preferences';
import type { RepositoryOverviewSamples } from '@/models/repository-overview';
import type { RepositoryPageSource } from '@/models/repository-page';
import type { RepositoryInsight } from '@/models/repository-insights';
import type { TimelineSupport } from '@/models/timeline-support';
import { readSavedTableSort } from '@/lib/presentation/table-query';
import { readRepositoryPresentation } from '@/lib/presentation/repository-page-preferences';
import { overviewSavedValues } from '@/lib/presentation/overview-settings';
import {
  drilldownPresentation,
  type RepositoryLinkPresentation,
  type SavedRecordPresentation,
} from '@/lib/presentation/repository-url';
import type { SavedViewValues } from '@/lib/presentation/url/entry';
import type { UrlValues } from '@/lib/presentation/url/registry';
import { overviewSettingsColumns } from '@/features/repositories/overview-columns';
import type { RepositoriesPreferences } from './repositories-screen';
import type { RepositoryPagePreferences } from './repository-page-screen';

// Route composition for the repositories area: each screen's saved sections, validated through the
// existing readers for the signed-in session. Every function takes the request's snapshot, so the
// pages read each cookie once and tests can pass a snapshot directly. Record and insight column
// lists are built in client modules, which the server cannot evaluate, so their sections are
// checked for shape here and the client applies them only to columns its table has.

/** All repositories settings and the sorts of its two tables. */
export function repositoriesPreferences(
  snapshot: PreferenceSnapshot,
  samples: RepositoryOverviewSamples,
): RepositoriesPreferences {
  const definition = {
    ...overviewSettingsColumns,
    repositoryIds: samples.repositories.map((row) => row.repository.id),
  };
  return {
    overview: savedOverviewSettings(snapshot, definition, samples.asOf),
    backlogSort: savedTableSort(
      snapshot,
      'overview.backlog.sort',
      overviewSettingsColumns.backlogColumns,
    ),
    activitySort: savedTableSort(
      snapshot,
      'overview.activity.sort',
      overviewSettingsColumns.activityColumns,
    ),
    links: repositoryLinkPresentation(snapshot),
  };
}
/** The saved Summary a bare `/repos` entry redirects to (decision C2), or null for none. */
export function summaryEntryValues(preferences: RepositoriesPreferences): SavedViewValues | null {
  return overviewSavedValues(
    preferences.overview.value,
    preferences.backlogSort.value,
    preferences.activitySort.value,
  );
}

/**
 * Every repository list's and insight's saved presentation, which links to them carry (decision
 * C3) and a bare list entry redirects to. Record sections are checked for shape here; the link
 * applies only the choices the target table has.
 */
export function repositoryLinkPresentation(
  snapshot: PreferenceSnapshot,
): RepositoryLinkPresentation {
  const list = (kind: 'prs' | 'issues'): SavedRecordPresentation => ({
    sort: savedSortShape(snapshot, `repository.${kind}.sort`).value,
    presentation: savedPreference(snapshot, `repository.${kind}.columns`, (raw) =>
      readRepositoryPresentation(raw),
    ).value,
  });
  return {
    prs: list('prs'),
    issues: list('issues'),
    authors: savedSortShape(snapshot, 'repository.authors.sort').value,
    mergedPrs: savedSortShape(snapshot, 'repository.merged-prs.sort').value,
    credits: savedSortShape(snapshot, 'repository.credits.sort').value,
  };
}
/** The saved presentation a bare repository list entry (`/repos/<slug>`, `?view=issues`) takes. */
export function recordEntryValues(
  values: UrlValues,
  links: RepositoryLinkPresentation,
): SavedViewValues {
  const metric = values.view === 'issues' ? 'openIssues' : 'totalOpenPrs';
  return { presentation: drilldownPresentation({ scope: 'current', metric }, links) };
}

/** A record list's sort and its columns and charts, shared by every repository's list of a kind. */
export function repositoryPagePreferences(
  snapshot: PreferenceSnapshot,
  source: RepositoryPageSource,
): RepositoryPagePreferences {
  return {
    sort: savedSortShape(snapshot, `repository.${source.kind}.sort`),
    presentation: savedPreference(snapshot, `repository.${source.kind}.columns`, (raw) =>
      readRepositoryPresentation(raw),
    ),
    links: repositoryLinkPresentation(snapshot),
  };
}

/** A saved sort checked for shape; a sort on a column a table lacks does not apply to that table. */
function savedSortShape(
  snapshot: PreferenceSnapshot,
  section: PreferenceSectionKey,
): SavedPreference<SavedTableSort> {
  return savedPreference(snapshot, section, (raw) => {
    const value: unknown = JSON.parse(raw);
    const column =
      value && typeof value === 'object' && 'sort' in value && typeof value.sort === 'string'
        ? value.sort
        : null;
    return column === null ? null : readSavedTableSort(raw, [column]);
  });
}

/** The insight table's sort: merged pull requests, authors or credits. */
export function repositoryInsightSort(
  snapshot: PreferenceSnapshot,
  insight: RepositoryInsight,
): SavedPreference<SavedTableSort> {
  return savedSortShape(
    snapshot,
    insight.kind === 'duration'
      ? 'repository.merged-prs.sort'
      : insight.kind === 'authors'
        ? 'repository.authors.sort'
        : 'repository.credits.sort',
  );
}

/** Which cookie holds a Timeline supporting table's sort: contribution records live site-wide. */
export function timelineSupportCookie(detail: TimelineSupport) {
  return detail.kind === 'contribution' ? 'contributions' : 'repositories';
}
/** A Timeline supporting table's sort, per detail kind and record kind. */
export function timelineSupportSort(
  snapshot: PreferenceSnapshot,
  detail: TimelineSupport,
): SavedPreference<SavedTableSort> {
  return savedSortShape(
    snapshot,
    detail.kind === 'contribution'
      ? 'timeline-support.contribution.sort'
      : `timeline-support.${detail.kind}.${detail.recordKind}.sort`,
  );
}
/** Reads the cookie that holds a Timeline supporting table's sort. */
export async function readTimelineSupportSort(detail: TimelineSupport) {
  return timelineSupportSort(await readPreferences(timelineSupportCookie(detail)), detail);
}
