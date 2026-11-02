'use client';
import { isKnownZeroContribution } from '@/lib/presentation/contribution-table-values';
import { noReviewerActivity } from '@/lib/presentation/contribution-lens';
import type { ColumnVisibility } from '@/components/tables/table-columns';
import { useId, useState } from 'react';
import { additionalMetricIds } from '@/models/contribution-activity';
import { DataTable } from '@/components/tables/data-table';
import { Callout } from '@/components/feedback/callout';
import { EmptyState } from '@/components/feedback/empty-state';
import type { TableController } from '@/lib/presentation/table-controller';
import type { ContributionArea, ContributionPage } from '@/models/contribution-page';
import {
  contributionMetricIds,
  contributionMetrics,
  type ContributionPopulation,
} from '@/models/contributions';
import { Switch } from '@/components/ui/switch';
import { countLabel } from '@/lib/presentation/format';
import { roleMetrics, type PopulationRole } from '@/models/contribution-lens';
import {
  ContributionMetricLink,
  contributorColumns,
  companyColumns,
  repositoryContributionColumns,
  type ContributionLinks,
} from './contribution-columns';
import { contributionCsvAlternatives, contributionCsvDownload } from './contribution-csv-export';
import { ContributionHeader } from './contribution-header';
import type { ReportToolbarControls } from '@/components/reporting/report-toolbar';
import styles from './contributions.module.css';

const clusterLabels: Record<PopulationRole, string> = {
  contributor: 'Contributor activity',
  reviewer: 'Reviewer activity',
};
/**
 * A focused report's six credit totals in two labelled clusters, Contributor activity and Reviewer
 * activity, the lens's own cluster first; each lists its role's metrics in report order.
 */
function ReportTotals({ page, links }: { page: ContributionPage; links: ContributionLinks }) {
  const id = useId();
  const report = page.report;
  const roles: PopulationRole[] =
    page.lens === 'reviewers' ? ['reviewer', 'contributor'] : ['contributor', 'reviewer'];
  return (
    <section aria-label="Report totals" className={styles.totals + ' ' + styles.clusters}>
      <h2 className="sr-only">Report totals</h2>
      {roles.map((role) => (
        <div key={role} role="group" aria-labelledby={id + role} className={styles.cluster}>
          <h3 id={id + role}>{clusterLabels[role]}</h3>
          <dl>
            {roleMetrics[role].map((metric) => (
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
        </div>
      ))}
    </section>
  );
}
/**
 * The Reviewers lens's notice for a report whose review, approval and merge totals are all known
 * zero. Partial or missing totals are the coverage notice's to explain.
 */
export function NoReviewerActivity({ page }: { page: ContributionPage }) {
  if (page.lens !== 'reviewers' || !noReviewerActivity(page.report.totals)) return null;
  return (
    <Callout
      tone="info"
      as="aside"
      aria-label="Reviewer activity"
      lead="No reviewer activity in this scope."
    >
      No review, approval or merge credits fall in this period for the selected repositories and
      accounts.
    </Callout>
  );
}

/**
 * A Reviewers-lens overview's "Show all N accounts" ("Show all N companies" on Companies) switch:
 * on, the table lists every account or company with activity instead of reviewer evidence only.
 */
export function ShowAllSwitch({
  population,
  area,
  disabled,
  onChange,
}: {
  population: ContributionPopulation;
  area: ContributionArea;
  disabled?: boolean;
  onChange: (on: boolean) => void;
}) {
  const id = useId();
  const count = area === 'companies' ? population.allCompanyCount : population.allContributorCount;
  return (
    <div className={styles.memberControls}>
      <label className={styles.zeroToggle} htmlFor={id}>
        <Switch
          id={id}
          checked={population.showingAll}
          disabled={disabled}
          onCheckedChange={onChange}
        />
        {'Show all ' +
          count +
          ' ' +
          countLabel(
            count,
            area === 'companies'
              ? { singular: 'company', plural: 'companies' }
              : { singular: 'account', plural: 'accounts' },
          )}
      </label>
    </div>
  );
}

export function ContributionView({
  page,
  controller,
  links,
  breakdownControls,
  populationControls,
  toolbar,
  visibility,
}: {
  page: ContributionPage;
  controller: TableController;
  links: ContributionLinks;
  breakdownControls?: React.ReactNode;
  /** In the Reviewers lens, an overview's "Show all" switch inside its table panel. */
  populationControls?: React.ReactNode;
  toolbar?: ReportToolbarControls;
  visibility?: ColumnVisibility;
}) {
  const [localVisible, setVisible] = useState<Record<string, boolean>>(() =>
    Object.fromEntries(additionalMetricIds.map((metric) => [metric, false])),
  );
  const reviewers = page.lens === 'reviewers';
  // In the Reviewers lens, Hide zero reads the reviewer totals only.
  const zeroRole: PopulationRole | undefined = reviewers ? 'reviewer' : undefined;
  const visible = visibility?.value ?? localVisible;
  const report = page.report;
  if (
    !report.context.selection.repositoryIds.length ||
    !report.context.selection.actorTypes.length ||
    !report.context.includedAccountCount
  )
    return (
      <>
        <ContributionHeader page={page} links={links} toolbar={toolbar} />
        <EmptyState
          kind={
            report.context.selection.repositoryIds.length &&
            report.context.selection.actorTypes.length
              ? 'no-match'
              : 'empty'
          }
          title={
            !report.context.selection.repositoryIds.length
              ? 'No repositories selected'
              : !report.context.selection.actorTypes.length
                ? 'No account types selected'
                : 'No accounts match this report'
          }
        >
          Adjust the repositories, account types, included accounts or exclusions to see results.
        </EmptyState>
      </>
    );
  const table = report.table;
  if (!table) throw Error('Expected a contribution table');
  const incomplete = Object.values({ ...report.totals, ...report.additionalTotals }).filter(
    (value) => value.status !== 'complete',
  );
  // An overview lists only accounts with recorded activity or gaps, so with incomplete values an
  // empty list means the contributions are unavailable, not that there are none.
  const unconfirmed = report.kind === 'overview' && incomplete.length > 0;
  const tableCommon = {
    controller,
    csvAlternatives: contributionCsvAlternatives(page),
    csvDownload: contributionCsvDownload(page, 'summary'),
    exportContextKey: JSON.stringify([
      page.area,
      report.context,
      page.breakdown,
      page.hideZeroMembers,
      page.lens ?? 'contributors',
      !!page.allAccounts,
    ]),
    visibility: visibility ?? { value: visible, onChange: setVisible },
    search: 'local' as const,
    // A company report's breakdown switch, and a Reviewers overview's Show all switch, sit inside
    // the table panel.
    headerContent:
      report.kind === 'company'
        ? breakdownControls
        : report.kind === 'overview'
          ? populationControls
          : undefined,
    itemLabel: { singular: 'row', plural: 'rows' },
    exportName: page.area + '-sample.csv',
    empty: controller.query.search
      ? ({ kind: 'no-match', title: 'No matching rows' } as const)
      : unconfirmed
        ? ({ kind: 'missing', title: 'No confirmed contributions to list' } as const)
        : ({
            kind: 'empty',
            title:
              reviewers && report.kind === 'overview' && !page.allAccounts
                ? 'No reviewer activity in this period'
                : 'No counted contributions in this period',
          } as const),
    // A sort by a hidden column is described by the table's own footer note.
    footerNote: 'Credits, comment activity and merged PR volumes are separate measures.',
  };
  const people = contributorColumns(links, report.kind === 'overview'),
    companies = companyColumns(links),
    repositories = repositoryContributionColumns(links);
  return (
    <>
      <ContributionHeader page={page} links={links} toolbar={toolbar} />
      {incomplete.length > 0 && (
        <Callout
          tone="warning"
          as="aside"
          aria-label="Data coverage"
          lead={
            incomplete.every((value) => value.status === 'missing') &&
            incomplete.length === contributionMetricIds.length + additionalMetricIds.length
              ? 'Reporting values are unavailable.'
              : 'Some reporting values are incomplete.'
          }
        >
          Dashes mean unavailable; an asterisk marks a verified subtotal. Missing history is never
          counted as zero.
          {report.kind === 'overview' &&
            ' Only accounts with recorded activity or account-specific gaps are listed.'}
        </Callout>
      )}
      <NoReviewerActivity page={page} />
      {report.kind !== 'overview' && <ReportTotals page={page} links={links} />}
      <div className={styles.table}>
        {table.kind === 'contributors' || table.kind === 'companies' ? (
          table.kind === 'contributors' ? (
            <DataTable
              {...tableCommon}
              title={reviewers ? 'Reviewers' : 'Contributors'}
              description={
                !reviewers
                  ? 'Rank by any metric. Select a name for its repository breakdown or a metric for supporting records.'
                  : page.allAccounts
                    ? 'All accounts with recorded activity or incomplete history.'
                    : 'Accounts with a review, approval or merge credit, or incomplete reviewer history. Rank by any metric.'
              }
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
            title={reviewers ? 'Company members' : 'Company contributors'}
            description={
              !page.hideZeroMembers
                ? 'All included accounts are shown, including those with no counted contributions.'
                : reviewers
                  ? 'Members whose reviewer totals are known zero are hidden; members with incomplete reviewer metrics remain visible.'
                  : 'Known-zero totals are hidden; accounts with incomplete metrics remain visible.'
            }
            empty={
              controller.query.search
                ? { kind: 'no-match', title: 'No matching accounts' }
                : {
                    kind: 'empty',
                    title: !page.hideZeroMembers
                      ? 'No accounts in this report'
                      : reviewers
                        ? 'No members with nonzero or incomplete reviewer totals'
                        : 'No members with nonzero or incomplete totals',
                  }
            }
            rows={
              page.hideZeroMembers
                ? table.rows.filter((row) => !isKnownZeroContribution(row, zeroRole))
                : table.rows
            }
            columns={people}
          />
        ) : (
          <DataTable
            {...tableCommon}
            title="By repository"
            description="Repositories with activity (including optional metrics) or incomplete data. Confirmed-zero repositories are omitted."
            search="none"
            rows={table.rows}
            columns={repositories}
          />
        )}
      </div>
    </>
  );
}
