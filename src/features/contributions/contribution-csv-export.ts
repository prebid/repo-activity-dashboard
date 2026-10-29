import type { CsvExportAlternative } from '@/components/exports/csv-export-dialog';
import type { ContributionPage } from '@/models/contribution-page';
import { reportMetricIds } from '@/models/contribution-metrics';
import { contributionExportHref } from '@/lib/presentation/contribution-export';
/** Only overview/member tables gain a different row layout; focused repository tables already have it. */
export function contributionCsvAlternatives(page: ContributionPage): CsvExportAlternative[] {
  if (
    page.report.kind === 'contributor' ||
    (page.report.kind === 'company' && page.breakdown === 'repositories')
  )
    return [];
  return [
    {
      id: 'repositories',
      label: 'By repository',
      columnIds: reportMetricIds,
      description:
        'One row per matching entity and repository with activity or incomplete data. Entity and repository identities are included; confirmed-zero repository rows are omitted.',
      download: async ({ columnIds, query, signal }) => {
        const response = await fetch(
          contributionExportHref(page, query, 'repositories', columnIds),
          { credentials: 'same-origin', cache: 'no-store', signal },
        );
        if (
          !response.ok ||
          response.redirected ||
          !response.headers.get('content-type')?.startsWith('text/csv')
        )
          throw Error('CSV export unavailable');
        return { blob: await response.blob(), fileName: page.area + '-repositories-sample.csv' };
      },
    },
  ];
}
