import type { TimelineSourceIdentity } from '@/models/reporting-timeline';
import type { CsvExportAlternative } from '@/components/exports/csv-export-dialog';
import { postCsv } from '@/components/exports/csv-download';
import { timelineExportFileName } from '@/lib/presentation/timeline-csv';

/** Export the loaded source revision and full scope; UI row/window limits are not report limits. */
export function timelineCsvDownload(
  href: string,
  source: TimelineSourceIdentity,
): CsvExportAlternative['download'] {
  return async ({ columnIds, query, signal }) => {
    const url = new URL(href, 'https://dashboard.invalid');
    url.searchParams.set('timeline.sort', query.sort);
    url.searchParams.set('timeline.dir', query.descending ? 'desc' : 'asc');
    const blob = await postCsv(
      '/api/reporting/timeline-export',
      {
        href: url.pathname + url.search,
        revision: source.scenarioId,
        asOf: source.asOf,
        columns: columnIds,
      },
      signal,
    );
    return { blob, fileName: timelineExportFileName };
  };
}
