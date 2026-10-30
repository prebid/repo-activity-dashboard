'use client';
import { isKnownZeroContribution } from '@/lib/presentation/contribution-table-values';
import type { ColumnVisibility } from '@/components/tables/table-columns';
import { useState } from 'react';
import { additionalMetricIds, additionalMetricDefinitions } from '@/models/contribution-activity';
import { DataTable } from '@/components/tables/data-table';
import { PageState } from '@/components/feedback/page-state';
import type { TableController } from '@/lib/presentation/table-controller';
import type { ContributionPage } from '@/models/contribution-page';
import { contributionMetricIds, contributionMetrics } from '@/models/contributions';
import {
  ContributionMetricLink,
  contributorColumns,
  companyColumns,
  repositoryContributionColumns,
  type ContributionLinks,
} from './contribution-columns';
import { contributionCsvAlternatives, contributionCsvDownload } from './contribution-csv-export';
import { ContributionHeader } from './contribution-header';
import styles from './contributions.module.css';

export function ContributionView({
  page,
  controller,
  links,
  breakdownControls,
  controls,
  visibility,
}: {
  page: ContributionPage;
  controller: TableController;
  links: ContributionLinks;
  breakdownControls?: React.ReactNode;
  controls?: React.ReactNode;
  visibility?: ColumnVisibility;
}) {
  const [localVisible, setVisible] = useState<Record<string, boolean>>(() =>
    Object.fromEntries(additionalMetricIds.map((metric) => [metric, false])),
  );
  const visible = visibility?.value ?? localVisible;
  const report = page.report;
  if (
    !report.context.selection.repositoryIds.length ||
    !report.context.selection.actorTypes.length ||
    !report.context.includedAccountCount
  )
    return (
      <>
        <ContributionHeader page={page} links={links} controls={controls} />
        <PageState
          title={
            !report.context.selection.repositoryIds.length
              ? 'No repositories selected'
              : !report.context.selection.actorTypes.length
                ? 'No account types selected'
                : 'No accounts match this report'
          }
        >
          Adjust the repositories, account types, included accounts or exclusions to see results.
        </PageState>
      </>
    );
  const table = report.table;
  if (!table) throw Error('Expected a contribution table');
  const incomplete = Object.values({ ...report.totals, ...report.additionalTotals }).filter(
    (value) => value.status !== 'complete',
  );
  const optionalSort = additionalMetricIds.find((metric) => metric === controller.query.sort);
  const hiddenSort =
    optionalSort && visible[optionalSort] === false
      ? additionalMetricDefinitions[optionalSort]
      : undefined;
  const tableCommon = {
    controller,
    csvAlternatives: contributionCsvAlternatives(page),
    csvDownload: contributionCsvDownload(page, 'summary'),
    exportContextKey: JSON.stringify([
      page.area,
      report.context,
      page.breakdown,
      page.hideZeroMembers,
    ]),
    visibility: visibility ?? { value: visible, onChange: setVisible },
    itemLabel: { singular: 'row', plural: 'rows' },
    exportName: page.area + '-sample.csv',
    emptyTitle: controller.query.search
      ? 'No matching rows'
      : 'No counted contributions in this period',
    footerNote: hiddenSort
      ? `Sorted by ${hiddenSort.group} — ${hiddenSort.label} (${controller.query.descending ? 'descending' : 'ascending'}); its column is hidden.`
      : 'Credits, comment activity and merged PR volumes are separate measures.',
  };
  const people = contributorColumns(links, report.kind === 'overview'),
    companies = companyColumns(links),
    repositories = repositoryContributionColumns(links);
  return (
    <>
      <ContributionHeader page={page} links={links} controls={controls} />
      {incomplete.length > 0 && (
        <aside className={styles.notice} aria-label="Data coverage">
          <strong>
            {incomplete.every((value) => value.status === 'missing') &&
            incomplete.length === contributionMetricIds.length + additionalMetricIds.length
              ? 'Reporting values are unavailable.'
              : 'Some reporting values are incomplete.'}
          </strong>
          <span>
            {' '}
            Dashes mean unavailable; an asterisk marks a verified subtotal. Missing history is never
            counted as zero.
          </span>
        </aside>
      )}
      {report.kind !== 'overview' && (
        <section aria-label="Report totals" className={styles.totals}>
          <h2 className="sr-only">Report totals</h2>
          <dl>
            {contributionMetricIds.map((metric) => (
              <div key={metric}>
                <dt>{contributionMetrics[metric].label}</dt>
                <dd>
                  <ContributionMetricLink
                    value={report.totals[metric]}
                    metric={metric}
                    focus={report.context.focus}
                    links={links}
                  />
                </dd>
              </div>
            ))}
          </dl>
        </section>
      )}
      {report.kind === 'company' && breakdownControls}
      <div className={styles.table}>
        {table.kind === 'contributors' || table.kind === 'companies' ? (
          table.kind === 'contributors' ? (
            <DataTable
              {...tableCommon}
              title="Contributors"
              description="Rank by any metric. Select a name for its repository breakdown or a metric for supporting records."
              rows={table.rows}
              columns={people}
            />
          ) : (
            <DataTable
              {...tableCommon}
              title="Companies"
              description="Totals include every selected member, across all selected repositories."
              rows={table.rows}
              columns={companies}
            />
          )
        ) : table.kind === 'members' ? (
          <DataTable
            {...tableCommon}
            title="Company contributors"
            description={
              page.hideZeroMembers
                ? 'Known-zero totals are hidden; accounts with incomplete metrics remain visible.'
                : 'All included accounts are shown, including those with no counted contributions.'
            }
            emptyTitle={
              controller.query.search
                ? 'No matching accounts'
                : page.hideZeroMembers
                  ? 'No members with nonzero or incomplete totals'
                  : 'No accounts in this report'
            }
            rows={
              page.hideZeroMembers
                ? table.rows.filter((row) => !isKnownZeroContribution(row))
                : table.rows
            }
            columns={people}
          />
        ) : (
          <DataTable
            {...tableCommon}
            title="By repository"
            description="Repositories with activity (including optional metrics) or incomplete data. Confirmed-zero repositories are omitted."
            searchable={false}
            rows={table.rows}
            columns={repositories}
          />
        )}
      </div>
    </>
  );
}
