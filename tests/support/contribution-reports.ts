import type {
  ContributionReport,
  ContributionTable,
  ContributorMetricRow,
  CompanyMetricRow,
  RepositoryContributionRow,
} from '@/models/contributions';
/** Assert the requested public view rather than relying on a hidden second collection. */
export function reportRows(
  report: ContributionReport,
  kind: 'contributors' | 'members',
): ContributorMetricRow[];
export function reportRows(report: ContributionReport, kind: 'companies'): CompanyMetricRow[];
export function reportRows(
  report: ContributionReport,
  kind: 'repositories',
): RepositoryContributionRow[];
export function reportRows(report: ContributionReport, kind: ContributionTable['kind']) {
  if (report.table?.kind !== kind)
    throw Error('Expected ' + kind + ' table, received ' + report.table?.kind);
  return report.table.rows;
}
