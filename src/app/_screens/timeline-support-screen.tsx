'use client';
import { followCaptured } from '@/lib/navigation/follow-captured';
import { pendingTableQuery } from '@/lib/presentation/table-controller';
import { useMemo, useState } from 'react';
import { usePathname, useSearchParams, useRouter } from 'next/navigation';
import type { TimelineSupport } from '@/models/timeline-support';
import { useTableController } from '@/lib/navigation/use-table-controller';
import { followHref, useUrlState } from '@/lib/navigation/use-url-state';
import {
  timelineAuthorHref,
  timelineSupportScopeKey,
} from '@/lib/presentation/timeline-support-query';
import { columnTokens, visibleColumns } from '@/lib/presentation/url/defaults';
import { parseQuery } from '@/lib/presentation/url/codec';
import { matchRoute, type UrlValues } from '@/lib/presentation/url/registry';
import { writeBoundTableQuery, type TableFields } from '@/lib/presentation/url/table-binding';
import { TimelineSupportFrame } from '@/components/reporting/timeline-support-frame';
import { Callout } from '@/components/feedback/callout';
import {
  repositoryTimelineSupportColumns,
  timelineAuthorColumns,
  RepositoryTimelineSupportView,
} from '@/features/repositories/repository-timeline-support';
import { contributionDetailColumns } from '@/features/contributions/contribution-details-view';
import { ContributionTimelineSupportView } from '@/features/contributions/contribution-timeline-support';
import type { TableQuery } from '@/models/table-query';
import type { SavedPreference } from '@/models/preferences';
import type { RepositoryTimelineSnapshotMetric } from '@/models/repository-timeline';
import { repositoryRecordColumnDefaults } from '@/lib/presentation/repository-page-preferences';
import { repositoryTimelineSnapshotSelection } from '@/lib/presentation/repository-timeline';
type SavedSort = Pick<TableQuery, 'sort' | 'descending'>;
const tooLarge =
  'This selection is too large for a link. Reduce the columns or return to the Timeline to narrow its filters.';
export function TimelineSupportScreen({
  detail,
  viewerId,
  savedSort,
}: {
  detail: TimelineSupport;
  viewerId: string;
  /** The table's saved sort, checked for shape by route composition; without it, sorts are not saved. */
  savedSort?: SavedPreference<SavedSort>;
}) {
  const [notice, setNotice] = useState<string>();
  const path = usePathname(),
    search = useSearchParams().toString(),
    router = useRouter();
  const { route } = matchRoute(path)!;
  const url = useUrlState(route);
  const authors = detail.kind === 'authors';
  // The authors list keeps its table in `list*`, a records table in `d*`; both choose columns in
  // `dcols`, against the table's v1 columns.
  const fields: TableFields = useMemo(
    () =>
      authors
        ? { route, search: 'listq', sort: 'listsort', page: 'listpage' }
        : { route, search: 'dq', sort: 'dsort', page: 'dpage' },
    [authors, route],
  );
  const ids = useMemo(
    () =>
      (detail.kind === 'contribution'
        ? contributionDetailColumns(detail.details)
        : authors
          ? timelineAuthorColumns()
          : repositoryTimelineSupportColumns(
              detail.recordKind,
              detail.descriptor.basis === 'snapshot',
            )
      ).map((column) => column.id),
    [detail, authors],
  );
  const table = useMemo(() => {
    const defaults =
      detail.kind === 'repository'
        ? repositoryRecordColumnDefaults(
            detail.descriptor.basis === 'snapshot'
              ? repositoryTimelineSnapshotSelection(
                  detail.descriptor.metric as RepositoryTimelineSnapshotMetric,
                )
              : { scope: 'period', metric: detail.descriptor.metric },
            !!detail.author,
          )
        : {};
    return { ids, visible: new Set(ids.filter((id) => defaults[id] !== false)) };
  }, [detail, ids]);
  const controller = useTableController({
    queryKey: authors ? 'support.authors' : 'support.records',
    columnIds: ids,
    // The former localStorage scope, copied once into the saved section of this detail kind.
    scopeKey:
      'timeline-support:' +
      detail.context.source.scenarioId +
      ':' +
      (detail.kind === 'contribution'
        ? detail.kind
        : [detail.kind, detail.repository.id, detail.recordKind].join(':')),
    viewerId,
    historyMode: 'push',
    savedSort,
    defaultSort: {
      sort: authors ? 'recordCount' : detail.kind === 'contribution' ? 'creditedAt' : 'createdAt',
      descending: true,
    },
    fields,
  });
  const pending =
    timelineSupportScopeKey(path + '?' + search) !== timelineSupportScopeKey(detail.context.href);
  const parsed = parseQuery(route, search);
  const values: UrlValues = parsed.kind === 'canonical' ? parsed.values : {};
  const tokens = typeof values.dcols === 'object' ? values.dcols : [];
  const shown = visibleColumns(table, tokens) ?? [...table.visible];
  const visible = Object.fromEntries(ids.map((id) => [id, shown.includes(id)]));
  /** The view at an address with the table's state written in. */
  function snapshot(query: string, state: TableQuery) {
    const written = writeBoundTableQuery(fields, query, state);
    return path + (written ? '?' + written : '');
  }
  const href = pending ? detail.context.href : snapshot(search, pendingTableQuery(controller));
  const visibility = {
    value: visible,
    onChange: (value: Record<string, boolean>) => {
      if (pending) return;
      // A pending search is written first, so Back returns to the list as it was shown.
      controller.flushSearch();
      const current = parseQuery(route, window.location.search);
      const rest = Object.fromEntries(
        Object.entries(current.kind === 'canonical' ? current.values : values).filter(
          ([name]) => name !== 'dcols',
        ),
      );
      const next = columnTokens(
        table,
        ids.filter((id) => value[id] !== false),
      );
      if (!url.push(next.length ? { ...rest, dcols: next } : rest)) {
        setNotice(tooLarge);
        return;
      }
      setNotice(undefined);
    },
  };
  const tableController = {
    ...controller,
    reconcilePage: (page: number) => {
      if (!pending) controller.reconcilePage(page);
    },
  };
  return (
    <TimelineSupportFrame
      context={detail.context}
      title={detail.kind === 'contribution' ? detail.title : detail.repository.name}
      contribution={detail.kind === 'contribution'}
      authorBack={
        detail.kind === 'repository' && detail.author ? timelineAuthorHref(href, null) : undefined
      }
    >
      {notice && (
        <Callout tone="info" as="p" role="alert">
          {notice}
        </Callout>
      )}
      {detail.kind === 'contribution' ? (
        <ContributionTimelineSupportView
          detail={detail}
          controller={tableController}
          visibility={visibility}
          disabled={pending}
        />
      ) : (
        <RepositoryTimelineSupportView
          detail={detail}
          controller={tableController}
          visibility={visibility}
          disabled={pending}
          authorHref={(account) => (pending ? null : timelineAuthorHref(href, account))}
          onAuthor={(event) => {
            if (pending) return;
            const account = parseQuery(route, new URL(event.currentTarget.href).search);
            const author =
              account.kind === 'canonical' && typeof account.values.author === 'string'
                ? account.values.author
                : null;
            followCaptured(
              event,
              () => {
                const frozen = snapshot(window.location.search, controller.flushSearch());
                return { origin: frozen, href: timelineAuthorHref(frozen, author) };
              },
              (target) => followHref(router, target),
              () =>
                setNotice(
                  'This selection is too large for a detail link. Narrow the Timeline filters and try again.',
                ),
            );
          }}
        />
      )}
    </TimelineSupportFrame>
  );
}
