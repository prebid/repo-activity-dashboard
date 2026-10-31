import type { CsvExportAlternative } from '@/components/exports/csv-export-dialog';
import { postCsv } from '@/components/exports/csv-download';
import type { ContributionPage } from '@/models/contribution-page';
import { contributionExportHref } from '@/lib/presentation/contribution-export';
/** One transport and CSV schema for both layouts. POST keeps large selections out of URLs. */
export function contributionCsvDownload(
  page: ContributionPage,
  layout: 'summary' | 'repositories',
): CsvExportAlternative['download'] {
  return async ({ columnIds, query, signal }) => {
    const href = contributionExportHref(page, query, layout, columnIds);
    const [path, params] = href.split('?');
    const blob = await postCsv(path, { query: params }, signal);
    return { blob, fileName: page.area + '-' + layout + '-sample.csv' };
  };
}
/** Focused repository tables already have one row per repository. */
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
      description:
        'One row per matching entity and repository with activity or incomplete data. Entity and repository identities are included; confirmed-zero repository rows are omitted.',
      download: contributionCsvDownload(page, 'repositories'),
    },
  ];
}
