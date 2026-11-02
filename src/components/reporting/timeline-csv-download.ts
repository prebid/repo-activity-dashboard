import type { TimelineSourceIdentity } from '@/models/reporting-timeline';
import type { CsvExportAlternative } from '@/components/exports/csv-export-dialog';
import { postCsv } from '@/components/exports/csv-download';
import { timelineExportFileName } from '@/lib/presentation/timeline-csv';
import { viewHref, viewOf } from '@/lib/presentation/url/back';

/** Export the loaded source revision and full scope; UI row/window limits are not report limits. */
export function timelineCsvDownload(
  href: string,
  source: TimelineSourceIdentity,
): CsvExportAlternative['download'] {
  return async ({ columnIds, query, signal }) => {
    // The export follows the table's current sort, which the Timeline's href may not name yet.
    const view = query.sort ? viewOf(href) : null;
    const sorted =
      view &&
      viewHref(
        {
          ...view,
          values: { ...view.values, sort: (query.descending ? '-' : '') + query.sort },
        },
        'level',
      );
    const blob = await postCsv(
      '/api/reporting/timeline-export',
      {
        href: sorted ?? href,
        revision: source.scenarioId,
        asOf: source.asOf,
        columns: columnIds,
      },
      signal,
    );
    return { blob, fileName: timelineExportFileName };
  };
}
