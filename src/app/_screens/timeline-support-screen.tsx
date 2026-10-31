'use client';
import { useMemo, useState } from 'react';
import { usePathname, useSearchParams, useRouter } from 'next/navigation';
import type { TimelineSupport } from '@/models/timeline-support';
import { useTableController } from '@/lib/navigation/use-table-controller';
import { writeTableQuery } from '@/lib/presentation/table-query';
import {
  resolveTableColumns,
  writeTableColumns,
} from '@/lib/presentation/table-column-preferences';
import {
  timelineAuthorHref,
  timelineSupportScopeKey,
} from '@/lib/presentation/timeline-support-query';
import { contributionUrlFits } from '@/lib/presentation/contribution-return';
import { TimelineSupportFrame } from '@/components/reporting/timeline-support-frame';
import {
  repositoryTimelineSupportColumns,
  timelineAuthorColumns,
  RepositoryTimelineSupportView,
} from '@/features/repositories/repository-timeline-support';
import { contributionDetailColumns } from '@/features/contributions/contribution-details-view';
import { ContributionTimelineSupportView } from '@/features/contributions/contribution-timeline-support';
import type { TableQuery } from '@/models/table-query';
import type { RepositoryTimelineSnapshotMetric } from '@/models/repository-timeline';
import { repositoryRecordColumnDefaults } from '@/lib/presentation/repository-page-preferences';
import { repositoryTimelineSnapshotSelection } from '@/lib/presentation/repository-timeline';
export function TimelineSupportScreen({
  detail,
  viewerId,
}: {
  detail: TimelineSupport;
  viewerId: string;
}) {
  const [notice, setNotice] = useState<string>();
  const path = usePathname(),
    search = useSearchParams().toString(),
    router = useRouter();
  const key = detail.kind === 'authors' ? 'support.authors' : 'support.records';
  const ids = useMemo(
    () =>
      (detail.kind === 'contribution'
        ? contributionDetailColumns(detail.details)
        : detail.kind === 'authors'
          ? timelineAuthorColumns()
          : repositoryTimelineSupportColumns(
              detail.recordKind,
              detail.descriptor.basis === 'snapshot',
            )
      ).map((column) => column.id),
    [detail],
  );
  const defaults = useMemo<Record<string, boolean>>(
    (): Record<string, boolean> =>
      detail.kind === 'repository'
        ? repositoryRecordColumnDefaults(
            detail.descriptor.basis === 'snapshot'
              ? repositoryTimelineSnapshotSelection(
                  detail.descriptor.metric as RepositoryTimelineSnapshotMetric,
                )
              : { scope: 'period', metric: detail.descriptor.metric },
          )
        : {},
    [detail],
  );
  const table = useTableController({
    queryKey: key,
    columnIds: ids,
    scopeKey: 'timeline-support:' + detail.context.source.scenarioId + ':' + detail.kind,
    viewerId,
    historyMode: 'push',
    defaultSort: {
      sort:
        detail.kind === 'authors'
          ? 'recordCount'
          : detail.kind === 'contribution'
            ? 'creditedAt'
            : 'createdAt',
      descending: true,
    },
  });
  const pending =
    timelineSupportScopeKey(path + '?' + search) !== timelineSupportScopeKey(detail.context.href);
  const visible = resolveTableColumns(search, key, defaults, {}, ids);
  function snapshot(input: string, query: TableQuery) {
    return path + '?' + writeTableColumns(writeTableQuery(input, key, query), key, visible, ids);
  }
  const href = pending
    ? detail.context.href
    : snapshot(search, {
        ...table.query,
        search: table.draftSearch,
        page: table.draftSearch === table.query.search ? table.query.page : 1,
      });
  const visibility = {
    value: visible,
    onChange: (value: Record<string, boolean>) => {
      if (pending) return;
      const proposed = new URL(href, 'https://dashboard.invalid');
      const next = path + '?' + writeTableColumns(proposed.search, key, value, ids);
      if (!contributionUrlFits(next)) {
        setNotice(
          'This selection is too large for a link. Reduce the columns or return to the Timeline to narrow its filters.',
        );
        return;
      }
      setNotice(undefined);
      const frozen = snapshot(window.location.search, table.flushSearch());
      if (contributionUrlFits(frozen)) window.history.replaceState(null, '', frozen);
      window.history.pushState(null, '', next);
    },
  };
  const controller = {
    ...table,
    reconcilePage: (page: number) => {
      if (!pending) table.reconcilePage(page);
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
      {notice && <p role="alert">{notice}</p>}
      {detail.kind === 'contribution' ? (
        <ContributionTimelineSupportView
          detail={detail}
          controller={controller}
          visibility={visibility}
          disabled={pending}
        />
      ) : (
        <RepositoryTimelineSupportView
          detail={detail}
          controller={controller}
          visibility={visibility}
          disabled={pending}
          authorHref={(account) => (pending ? null : timelineAuthorHref(href, account))}
          onAuthor={(event) => {
            if (
              pending ||
              event.button !== 0 ||
              event.metaKey ||
              event.ctrlKey ||
              event.altKey ||
              event.shiftKey
            )
              return;
            event.preventDefault();
            const account = new URL(event.currentTarget.href).searchParams.get('support.author'),
              frozen = snapshot(window.location.search, table.flushSearch()),
              next = timelineAuthorHref(frozen, account);
            if (next && contributionUrlFits(frozen)) {
              window.history.replaceState(null, '', frozen);
              router.push(next);
            } else
              setNotice(
                'This selection is too large for a detail link. Narrow the Timeline filters and try again.',
              );
          }}
        />
      )}
    </TimelineSupportFrame>
  );
}
