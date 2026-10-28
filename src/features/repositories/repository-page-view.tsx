'use client';
import { useState } from 'react';
import Link from 'next/link';
import type { RepositoryPageModel, RepositoryPageNavigation } from '@/models/repository-page';
import type { TableController } from '@/lib/presentation/table-controller';
import { DataTable } from '@/components/tables/data-table';
import { PageState } from '@/components/feedback/page-state';
import { recordListTitle } from '@/lib/presentation/repository-records';
import { repositoryDrilldownHref } from '@/lib/presentation/repository-drilldown';
import { periodRangeLabel } from '@/lib/presentation/overview-periods';
import { formatCount } from '@/lib/presentation/format';
import { RepositoryHeader } from './repository-header';
import { repositoryPagePrColumns, repositoryPageIssueColumns } from './repository-page-columns';
import styles from './repository-page.module.css';

function RepositoryPageTable({
  page,
  controller,
}: {
  page: RepositoryPageModel;
  controller: TableController;
}) {
  const selection = page.drilldown.selection,
    metric = selection.metric;
  const current = selection.scope === 'current';
  const generalPr = current && ['totalOpenPrs', 'nonDraftPrs'].includes(metric);
  const [visible, setVisible] = useState<Record<string, boolean>>({
    labels: false,
    state: false,
    authorType: false,
    createdAt: !current,
    ageDays: current,
    humanReviewers: generalPr || metric.startsWith('humanReviewers'),
    approvals: generalPr || metric.startsWith('humanApprovals'),
    mergedAt: metric === 'prsMerged',
    mergeDays: metric === 'prsMerged',
    baseBranch: metric === 'prsMerged',
    closedAt: metric === 'issuesClosed',
    agentReviewer: metric === 'agentFeedbackPrs',
    botReviewer: metric === 'botFeedbackPrs',
    latestActor: false,
    latestActivity: current,
    assignees: false,
  });
  const title = recordListTitle(selection, page.author?.account);
  const common = {
    title,
    controller,
    visibility: { value: visible, onChange: setVisible },
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
          itemLabel="PRs"
        />
      ) : (
        <DataTable
          {...common}
          rows={page.rows}
          columns={repositoryPageIssueColumns}
          columnMenuColumns={repositoryPageIssueColumns.filter((column) => !inline.has(column.id))}
          itemLabel="issues"
        />
      )}
    </div>
  );
}
export function RepositoryPageView({
  page,
  navigation,
  controller,
}: {
  page: RepositoryPageModel;
  navigation: RepositoryPageNavigation;
  controller: TableController;
}) {
  const { selection, returnTo } = page.drilldown;
  const current = selection.scope === 'current';
  const baseline = page.kind === 'prs' ? 'totalOpenPrs' : 'openIssues';
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
                  : selection.metric === 'draftPrs'
                    ? 'Drafts only'
                    : selection.metric === 'totalOpenPrs'
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
                <span>Created during this period · All statuses</span>
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
      {page.measurement.value === null ? (
        <PageState title="Sample records unavailable">{page.measurement.reason}</PageState>
      ) : (
        <RepositoryPageTable
          key={JSON.stringify([page.repository.id, selection, page.author?.account])}
          page={page}
          controller={controller}
        />
      )}
    </>
  );
}
