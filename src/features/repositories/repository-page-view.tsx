'use client';
import { useState } from 'react';
import Link from 'next/link';
import type { RepositoryPageModel, RepositoryPageNavigation } from '@/models/repository-page';
import type { TableController } from '@/lib/presentation/table-controller';
import type { ColumnVisibility } from '@/components/tables/table-columns';
import { requiresNonDraftPr } from '@/lib/presentation/repository-page-rules';
import { repositoryColumnDefaults } from '@/lib/presentation/repository-page-preferences';
import { DataTable } from '@/components/tables/data-table';
import { Callout } from '@/components/feedback/callout';
import { EmptyState } from '@/components/feedback/empty-state';
import { LinkPending } from '@/components/navigation/link-pending';
import { recordListTitle } from '@/lib/presentation/repository-records';
import { repositoryDrilldownHref } from '@/lib/presentation/repository-drilldown';
import { zonedRangeLabel } from '@/lib/presentation/overview-periods';
import { repositoryFiltersNarrow } from '@/lib/presentation/repository-page-query';
import { formatCount } from '@/lib/presentation/format';
import {
  noReportControls,
  ReportToolbar,
  reportToolbarStatus,
  type ReportToolbarGroup,
} from '@/components/reporting/report-toolbar';
import { RepositoryHeader } from './repository-header';
import {
  repositoryPagePrColumns,
  repositoryPageIssueColumns,
  repositoryInlineColumnIds,
} from './repository-page-columns';
import styles from './repository-page.module.css';

export interface RepositoryPageControls {
  timelineHref?: string | null;
  onTimeline?: React.MouseEventHandler<HTMLAnchorElement>;
  timelinePending?: boolean;
  filters: React.ReactNode;
  charts?: React.ReactNode;
  /** The record scope fields; absent on author lists, whose scope is fixed. */
  scope?: React.ReactNode;
  /** Columns, sorting and chart visibility are saved; Reset view restores them. */
  preferences: { storageAvailable: boolean; onReset: () => void };
  visibility: ColumnVisibility;
}

function RepositoryPageTable({
  page,
  controller,
  controls,
}: {
  page: RepositoryPageModel;
  controller: TableController;
  controls?: RepositoryPageControls;
}) {
  const selection = page.drilldown.selection;
  const [visible, setVisible] = useState(() => repositoryColumnDefaults(page));
  const title = recordListTitle(selection, page.author?.account);
  const common = {
    title,
    controller,
    visibility: controls?.visibility ?? { value: visible, onChange: setVisible },
    // With page controls, the filter bar holds the search and the rows arrive already searched.
    search: controls ? ('external' as const) : ('local' as const),
    // Record filters are applied before the table, so it cannot see them narrow its rows.
    filtered: repositoryFiltersNarrow(page.filters),
    headerContent: controls?.filters,
    empty: page.cohortMeasurement.value
      ? ({ kind: 'no-match', title: 'No matching items' } as const)
      : ({ kind: 'empty', title: 'No items' } as const),
    description:
      controller.query.sort === 'createdAt' && controller.query.descending
        ? 'Newest created first'
        : undefined,
    footerNote:
      page.kind === 'prs'
        ? 'Sample record links are placeholders. Reviewers and current approvals are separate measures.'
        : 'Sample record links are placeholders.',
  };
  return (
    <div className={styles.records}>
      {page.kind === 'prs' ? (
        <DataTable
          {...common}
          rows={page.rows}
          columns={repositoryPagePrColumns}
          columnMenuColumns={repositoryPagePrColumns.filter(
            (column) => !repositoryInlineColumnIds.has(column.id),
          )}
          itemLabel={{ singular: 'PR', plural: 'PRs' }}
        />
      ) : (
        <DataTable
          {...common}
          rows={page.rows}
          columns={repositoryPageIssueColumns}
          columnMenuColumns={repositoryPageIssueColumns.filter(
            (column) => !repositoryInlineColumnIds.has(column.id),
          )}
          itemLabel={{ singular: 'issue', plural: 'issues' }}
        />
      )}
    </div>
  );
}
/**
 * Reset view restores the saved columns, sorting and charts and keeps the record scope, so its
 * group is named for what it restores and the Record scope select has a group of its own.
 */
function viewGroup(controls: RepositoryPageControls): ReportToolbarGroup {
  return {
    label: 'Columns, sorting and charts',
    controls: null,
    reset: { label: 'Reset view', onReset: controls.preferences.onReset },
  };
}
export function RepositoryPageView({
  page,
  navigation,
  controller,
  controls,
}: {
  page: RepositoryPageModel;
  navigation: RepositoryPageNavigation;
  controller: TableController;
  controls?: RepositoryPageControls;
}) {
  const { selection, returnTo } = page.drilldown;
  const current = selection.scope === 'current';
  const baseline = page.kind === 'prs' ? 'totalOpenPrs' : 'openIssues';
  const prFilters = page.filters.kind === 'prs' ? page.filters : undefined;
  const nonDraftFiltered = requiresNonDraftPr(page.filters, selection);

  const focused = selection.metric !== baseline || !!page.author;
  const title = recordListTitle(selection, page.author?.account);
  return (
    <>
      <RepositoryHeader
        repository={page.repository}
        asOf={page.asOf}
        returnTo={returnTo}
        navigation={navigation}
        activeKind={page.kind}
        timelineHref={controls?.timelineHref}
        onTimeline={controls?.onTimeline}
        timelinePending={controls?.timelinePending}
        parentLink={
          page.author
            ? {
                href: page.author.returnTo,
                label: page.kind === 'prs' ? 'PR authors' : 'Issue authors',
              }
            : undefined
        }
      />
      <ReportToolbar
        label="Selected repository scope"
        {...(controls
          ? {
              disabled: false,
              groups: controls.scope
                ? [{ label: 'Record scope', controls: controls.scope }, viewGroup(controls)]
                : [viewGroup(controls)],
              status: reportToolbarStatus(false, controls.preferences.storageAvailable, 'report'),
            }
          : noReportControls)}
        summary={{
          lead: title,
          facts: [
            // The record scope select names the scope when it is shown.
            ...(controls?.scope ? [] : [current ? 'Current open' : 'Period activity']),
            formatCount(page.measurement.value) +
              (page.measurement.status === 'partial'
                ? ' available sample records'
                : ' matching records'),
            ...(current
              ? page.kind === 'prs' || page.author || focused
                ? [
                    page.kind === 'issues'
                      ? 'Open issues'
                      : selection.metric === 'draftPrs' || prFilters?.draft === 'drafts'
                        ? 'Drafts only'
                        : selection.metric === 'totalOpenPrs' &&
                            prFilters?.draft !== 'non-drafts' &&
                            !nonDraftFiltered
                          ? 'Includes drafts'
                          : 'Excludes drafts',
                  ]
                : []
              : [zonedRangeLabel(selection.range)]),
            ...(!current && selection.branch ? ['Primary branch: ' + selection.branch] : []),
            ...(page.author
              ? [
                  'Author: ' + page.author.account,
                  'Created during this period' +
                    (page.filters.states.length ? '' : ' · All statuses'),
                ]
              : []),
            ...(focused
              ? [
                  <Link
                    key="all"
                    className={styles.scopeLink}
                    prefetch={false}
                    href={repositoryDrilldownHref(page.repository, {
                      selection: { scope: 'current', metric: baseline },
                      returnTo,
                    })}
                  >
                    All open {page.kind === 'prs' ? 'PRs' : 'issues'}
                    <LinkPending />
                  </Link>,
                ]
              : []),
          ],
        }}
      />
      {page.measurement.status === 'partial' && (
        <Callout tone="warning" as="p" role="status">
          Partial sample coverage: {page.measurement.reason} This list contains the available
          entries only.
        </Callout>
      )}
      {controls?.charts}
      {page.measurement.value === null ? (
        <>
          {controls?.filters}
          <EmptyState kind="missing" title="Sample records unavailable">
            {page.measurement.reason}
          </EmptyState>
        </>
      ) : (
        <RepositoryPageTable
          key={JSON.stringify([page.repository.id, selection, page.author?.account])}
          page={page}
          controller={controller}
          controls={controls}
        />
      )}
    </>
  );
}
