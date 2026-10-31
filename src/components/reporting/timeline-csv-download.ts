import type { TimelineSourceIdentity } from '@/models/reporting-timeline';
import type { CsvExportAlternative } from '@/components/exports/csv-export-dialog';
/** Export the loaded source revision and full scope; UI row/window limits are not report limits. */
export function timelineCsvDownload(
  href: string,
  source: TimelineSourceIdentity,
): CsvExportAlternative['download'] {
  return async ({ columnIds, query, signal }) => {
    const url = new URL(href, 'https://dashboard.invalid');
    url.searchParams.set('timeline.sort', query.sort);
    url.searchParams.set('timeline.dir', query.descending ? 'desc' : 'asc');
    const response = await fetch('/api/reporting/timeline-export', {
      method: 'POST',
      credentials: 'same-origin',
      cache: 'no-store',
      signal,
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        href: url.pathname + url.search,
        revision: source.scenarioId,
        asOf: source.asOf,
        columns: columnIds,
      }),
    });
    if (
      !response.ok ||
      response.redirected ||
      !response.headers.get('content-type')?.startsWith('text/csv')
    )
      throw Error('Timeline export is unavailable.');
    return { blob: await response.blob(), fileName: 'timeline-sample.csv' };
  };
}
