import 'server-only';
import { z } from 'zod';
import { requireViewer } from '@/lib/auth/viewer';
import { readBoundedBody, RequestBodyError } from '@/lib/auth/bounded-request';
import { loadTimelineReport } from './timeline-report';
import { repositoryTimelineMetricSchema } from '@/models/repository-timeline';
import { timelineCsv } from '@/lib/presentation/timeline-csv';
const headers = { 'cache-control': 'private, no-store', 'x-content-type-options': 'nosniff' };
export async function timelineExportResponse(request: Request) {
  await requireViewer();
  if (
    request.headers.get('content-type')?.split(';')[0].trim().toLowerCase() !== 'application/json'
  )
    return new Response('Expected JSON.', { status: 415, headers });
  let input;
  try {
    input = z
      .object({
        href: z.string().max(7500),
        revision: z.string().min(1).max(500),
        asOf: z.string().min(1).max(40),
        columns: z.array(z.string().min(1).max(100)).min(1).max(100),
      })
      .strict()
      .parse(JSON.parse(new TextDecoder().decode(await readBoundedBody(request, 64 * 1024))));
  } catch (error) {
    return new Response('Invalid export options.', {
      status: error instanceof RequestBodyError ? error.status : 400,
      headers,
    });
  }
  const loaded = await loadTimelineReport(input.href);
  if (loaded.status !== 'ready')
    return new Response('Invalid Timeline scope.', { status: 400, headers });
  const report = loaded.category === 'matrix' ? loaded.matrix : loaded.report;
  if (report.source.scenarioId !== input.revision || report.source.asOf !== input.asOf)
    return new Response('Timeline source has changed. Reload before exporting.', {
      status: 409,
      headers,
    });
  let csv;
  try {
    csv = timelineCsv(
      report,
      input.columns,
      {
        search: '',
        sort: loaded.controls.view.sort,
        descending: loaded.controls.view.descending,
        page: 1,
      },
      loaded.category === 'matrix' && loaded.matrix.scope.metrics.length
        ? repositoryTimelineMetricSchema.parse(loaded.controls.view.metric)
        : undefined,
    );
  } catch {
    return new Response('Invalid export columns.', { status: 400, headers });
  }
  return new Response(csv, {
    headers: {
      ...headers,
      'content-type': 'text/csv; charset=utf-8',
      'content-disposition': 'attachment; filename="timeline-sample.csv"',
    },
  });
}
