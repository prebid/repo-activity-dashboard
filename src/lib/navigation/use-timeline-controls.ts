'use client';
import { useEffect, useRef, useState, useTransition } from 'react';
import { usePathname, useSearchParams } from 'next/navigation';
import type { TimelineControlContext, TimelineViewState } from '@/models/timeline-controls';
import type { PeriodSelection } from '@/models/reporting-period';
import type { RepositoryPageFilters } from '@/models/repository-page';
import type { ContributionSettings } from '@/models/contribution-settings';
import type { TableController } from '@/lib/presentation/table-controller';
import {
  explicitTimelineQuery,
  rememberedTimelinePreferences,
  resolveTimelinePresentation,
  storedTimelinePreferences,
  timelineFiltersProposal,
  timelinePeriodProposal,
  timelinePreferenceKey,
  timelineRepositoriesProposal,
  timelineResetProposal,
  timelineScopeProposal,
  timelineScopeResetProposal,
  timelineTarget,
  timelineViewProposal,
} from '@/lib/presentation/timeline-controls';
import {
  readContributionPreferenceCandidate,
  defaultContributionSettings,
  mergeContributionPreferences,
  serializeContributionPreferences,
  type ContributionSettingField,
} from '@/lib/presentation/contribution-settings';
import { backFrames, viewHref } from '@/lib/presentation/url/back';
import { parseQuery } from '@/lib/presentation/url/codec';
import { timelineStateValues } from '@/lib/presentation/url/legacy/decode';
import { matchRoute, type UrlValues } from '@/lib/presentation/url/registry';
import { readPreference, usePreferenceCookie } from './use-preference-cookie';
import { useUrlState } from './use-url-state';

const tooLarge = 'This view is too large for a link. Reduce the selection.';
const origin = 'https://dashboard.invalid';

/**
 * One URL owner for Timeline state. Facts remain in authenticated server composition, which also
 * applies saved preferences to an entry before the first render; this hook only saves deliberate
 * changes, through the sections in `context.preferences`. The controls compute their next view in
 * the Timeline's query form (decision C9) and write it to the address as registry values.
 */
export function useTimelineControls(
  viewerId: string,
  context: TimelineControlContext,
  defaults: Record<string, boolean>,
) {
  const { route, segments } = matchRoute(context.path)!;
  const url = useUrlState(route);
  const search = useSearchParams().toString();
  const [pending, startTransition] = useTransition();
  // A notice from this page's own edits replaces the server's entry notice for the same model.
  const [ownNotice, setOwnNotice] = useState<{ href: string; text?: string }>();
  const notice = ownNotice?.href === context.href ? ownNotice.text : context.preferences?.notice;
  const setNotice = (text?: string) => setOwnNotice({ href: context.href, text });
  const saved = context.preferences;
  const key = timelinePreferenceKey(viewerId, context);
  // The former localStorage value is copied once, for the next entry; this render is unchanged.
  const presentationCookie = usePreferenceCookie(saved?.presentation, {
    keys: [key],
    read: (raw) => storedTimelinePreferences(raw, context.area),
  });
  const scopeCookie = usePreferenceCookie(saved?.scope);
  const storageAvailable = presentationCookie.storageAvailable && scopeCookie.storageAvailable;
  const busy = useRef(false);
  useEffect(() => {
    if (!pending) busy.current = false;
  }, [pending]);
  const pathname = usePathname();
  const resolved = resolveTimelinePresentation(pathname, search, context);
  const awaitingData = resolved.awaitingData;
  // A page past the last one shows the last page; the correction is kept for this address only,
  // without a history write, and the next deliberate change writes it.
  const [correction, setCorrection] = useState<{ search: string; page: number }>();
  const view =
    !awaitingData && correction?.search === search
      ? { ...resolved.view, page: correction.page }
      : resolved.view;
  const directory = { repositories: context.repositories };
  /** The values of a Timeline query, with the address's own frames. */
  function valuesOf(query: string): UrlValues | null {
    return timelineStateValues(route, query, context.asOf, directory);
  }
  function apply(next: string, scope: boolean, rememberKeys: string[] = []) {
    if (busy.current || pending || awaitingData)
      return 'The current update is still loading. Try again when it finishes.';
    let target;
    try {
      target = timelineTarget(next, context);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Invalid Timeline change.';
      setNotice(message);
      return message;
    }
    const values = valuesOf(target);
    const href = values && url.href(values);
    if (!values || !href) {
      setNotice(tooLarge);
      return tooLarge;
    }
    setNotice(undefined);
    if (rememberKeys.length && saved)
      presentationCookie.write(
        rememberedTimelinePreferences(
          readPreference(saved.presentation.binding, saved.presentation.section),
          target,
          rememberKeys,
          context.area,
        ),
      );
    if (scope) {
      busy.current = true;
      startTransition(() => url.navigate(href, { scroll: false }));
    } else url.push(values);
  }
  const current = () => {
    const address = resolveTimelinePresentation(
      window.location.pathname,
      window.location.search,
      context,
    );
    return address.query;
  };
  function changeView(patch: Partial<TimelineViewState>) {
    const proposal = timelineViewProposal(current(), context, view, patch);
    return apply(proposal.query, proposal.scope, proposal.keys);
  }
  function period(value: PeriodSelection) {
    const proposal = timelinePeriodProposal(current(), context, view, value);
    return apply(proposal.query, true, proposal.keys);
  }
  function repositories(ids: string[]) {
    return apply(timelineRepositoriesProposal(current(), context, view, ids), true, ['repo']);
  }
  function filters(value: RepositoryPageFilters) {
    const proposal = timelineFiltersProposal(current(), context, view, value);
    return apply(proposal.query, true, proposal.keys);
  }
  function contribution(value: ContributionSettings, field: ContributionSettingField) {
    const error = apply(
      timelineScopeProposal(current(), context, view, value, field === 'period'),
      true,
    );
    if (error) return error;
    if (!saved?.scope) return;
    const prior =
      readContributionPreferenceCandidate(
        readPreference(saved.scope.binding, saved.scope.section),
        directory,
        context.asOf,
      ) ?? defaultContributionSettings(directory);
    scopeCookie.write(
      JSON.parse(
        serializeContributionPreferences(mergeContributionPreferences(prior, value, field)),
      ),
    );
  }
  function reset() {
    const error = apply(timelineResetProposal(current(), context, view), true);
    if (!error) presentationCookie.write(null);
  }
  function resetContribution() {
    const error = apply(timelineScopeResetProposal(current(), context, view), true);
    if (!error) scopeCookie.write(null);
  }
  const query = { search: '', sort: view.sort, descending: view.descending, page: view.page };
  const table: TableController = {
    scopeKey: key,
    query,
    draftSearch: '',
    setSearch: () => {},
    flushSearch: () => query,
    update: (patch) =>
      changeView({
        ...(patch.sort !== undefined ? { sort: patch.sort } : {}),
        ...(patch.descending !== undefined ? { descending: patch.descending } : {}),
        ...(patch.page !== undefined ? { page: patch.page } : {}),
      }),
    reconcilePage: (page) => {
      if (!pending && !awaitingData) setCorrection({ search, page });
    },
  };
  // The current view in explicit form, with the frames of the address it shows; while new data
  // loads, the rendered one.
  const active = new URL(awaitingData ? context.href : pathname + '?' + search, origin);
  const parsed = parseQuery(route, active.search);
  const shown = valuesOf(explicitTimelineQuery(resolved.query, context, view));
  const href =
    (shown &&
      viewHref(
        {
          route,
          segments,
          values: {
            ...shown,
            back: parsed.kind === 'canonical' ? backFrames(parsed.values) : [],
          },
        },
        'level',
        { explicit: true },
      )) ??
    context.href;
  return {
    view,
    period: context.period,
    changeView,
    changePeriod: period,
    changeRepositories: repositories,
    changeFilters: filters,
    changeContribution: contribution,
    reset,
    resetContribution,
    table,
    pending: pending || awaitingData,
    notice,
    storageAvailable,
    href,
    visibility: {
      value: view.columns
        ? Object.fromEntries(context.metricIds.map((id) => [id, view.columns!.includes(id)]))
        : defaults,
      onChange: (next: Record<string, boolean>) =>
        changeView({ columns: context.metricIds.filter((id) => next[id] !== false) }),
    },
  };
}
