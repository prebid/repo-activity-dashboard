'use client';
import { useState } from 'react';
import Link from 'next/link';
import type { RepositoryPageModel, RepositoryPageNavigation } from '@/models/repository-page';
import type { TableController } from '@/lib/presentation/table-controller';
import type { ColumnVisibility } from '@/components/tables/table-columns';
import { repositoryColumnDefaults } from '@/lib/presentation/repository-page-preferences';
import { DataTable } from '@/components/tables/data-table';
import { PageState } from '@/components/feedback/page-state';
import { recordListTitle } from '@/lib/presentation/repository-records';
import { repositoryDrilldownHref } from '@/lib/presentation/repository-drilldown';
import { periodRangeLabel } from '@/lib/presentation/overview-periods';
import { formatCount } from '@/lib/presentation/format';
import { RepositoryHeader } from './repository-header';
import { repositoryPagePrColumns, repositoryPageIssueColumns } from './repository-page-columns';
import styles from './repository-page.module.css';

export interface RepositoryPageControls {
  filters: React.ReactNode;
  charts?: React.ReactNode;
  scope?: React.ReactNode;
  preferences: React.ReactNode;
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
    searchable: !controls,
    headerContent: controls?.filters,
    emptyTitle: page.cohortMeasurement.value ? 'No matching items' : undefined,
    description:
      controller.query.sort === 'createdAt' && controller.query.descending
        ? 'Newest created first'
        : undefined,
    footerNote:
      page.kind === 'prs'
        ? 'Sample record links are placeholders. Reviewers and current approvals are separate measures.'
        : 'Sample record links are placeholders.',
  };
  const inline = new Set(['labels', 'state', 'authorType']);
  return (
    <div className={styles.records}>
      {page.kind === 'prs' ? (
        <DataTable
          {...common}
          rows={page.rows}
          columns={repositoryPagePrColumns}
          columnMenuColumns={repositoryPagePrColumns.filter((column) => !inline.has(column.id))}
          itemLabel={controls ? 'matching PRs' : 'PRs'}
        />
      ) : (
        <DataTable
          {...common}
          rows={page.rows}
          columns={repositoryPageIssueColumns}
          columnMenuColumns={repositoryPageIssueColumns.filter((column) => !inline.has(column.id))}
          itemLabel={controls ? 'matching issues' : 'issues'}
        />
      )}
    </div>
  );
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
  const reviewFiltered =
    prFilters &&
    [prFilters.reviewers, prFilters.approvals, prFilters.agentReviewer, prFilters.botReviewer].some(
      (value) => value !== undefined,
    );

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
        parentLink={
          page.author
            ? {
                href: page.author.returnTo,
                label: page.kind === 'prs' ? 'PR authors' : 'Issue authors',
              }
            : undefined
        }
      />
      {controls?.scope}
      <section aria-label="Selected repository scope" className={styles.scope}>
        <div className={styles.scopeMain}>
          <span className={styles.scopeTag}>{current ? 'Current open' : 'Period activity'}</span>
          <span className={styles.scopeTitle}>{title}</span>
          <span className={styles.matching}>
            {formatCount(page.measurement.value) +
              (page.measurement.status === 'partial'
                ? ' available sample records'
                : ' matching records')}
          </span>
        </div>
        {(!current || page.kind === 'prs' || page.author || focused) && (
          <div className={styles.scopeDetails}>
            {current ? (
              <span>
                {page.kind === 'issues'
                  ? 'Open issues'
                  : selection.metric === 'draftPrs' || prFilters?.draft === 'drafts'
                    ? 'Drafts only'
                    : selection.metric === 'totalOpenPrs' &&
                        prFilters?.draft !== 'non-drafts' &&
                        !reviewFiltered
                      ? 'Includes drafts'
                      : 'Excludes drafts'}
              </span>
            ) : (
              <span>{periodRangeLabel(selection.range)} · UTC</span>
            )}
            {!current && selection.branch && <span>Primary branch: {selection.branch}</span>}
            {page.author && (
              <>
                <span>Author: {page.author.account}</span>
                <span>
                  Created during this period{page.filters.states.length ? '' : ' · All statuses'}
                </span>
              </>
            )}
            {focused && (
              <Link
                prefetch={false}
                href={repositoryDrilldownHref(page.repository, {
                  selection: { scope: 'current', metric: baseline },
                  returnTo,
                })}
              >
                All open {page.kind === 'prs' ? 'PRs' : 'issues'}
              </Link>
            )}
          </div>
        )}
      </section>
      {page.measurement.status === 'partial' && (
        <p role="status" className={styles.notice}>
          Partial sample coverage: {page.measurement.reason} This list contains the available
          entries only.
        </p>
      )}
      {controls?.charts}
      {page.measurement.value === null ? (
        <>
          {controls?.filters}
          <PageState title="Sample records unavailable">{page.measurement.reason}</PageState>
        </>
      ) : (
        <RepositoryPageTable
          key={JSON.stringify([page.repository.id, selection, page.author?.account])}
          page={page}
          controller={controller}
          controls={controls}
        />
      )}
      {controls?.preferences}
    </>
  );
}
