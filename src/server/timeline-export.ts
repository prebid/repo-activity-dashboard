import 'server-only';
import { z } from 'zod';
import { requireViewer } from '@/lib/auth/viewer';
import { readReportingJson, reportingHeaders as headers } from '@/lib/auth/reporting-request';
import { loadTimelineReport } from './timeline-report';
import { repositoryTimelineMetricSchema } from '@/models/repository-timeline';
import {
  timelineCsv,
  TimelineCsvColumnError,
  timelineExportFileName,
} from '@/lib/presentation/timeline-csv';
const exportRequestSchema = z
  .object({
    href: z.string().max(7500),
    revision: z.string().min(1).max(500),
    asOf: z.string().min(1).max(40),
    columns: z.array(z.string().min(1).max(100)).min(1).max(100),
  })
  .strict();
export async function timelineExportResponse(request: Request) {
  await requireViewer();
  const read = await readReportingJson(
    request,
    exportRequestSchema,
    (status) =>
      new Response(status === 415 ? 'Expected JSON.' : 'Invalid export options.', {
        status,
        headers,
      }),
  );
  if (!read.ok) return read.response;
  const input = read.data;
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
  } catch (error) {
    // Only a column choice is the caller's error; anything else is a server fault.
    if (error instanceof TimelineCsvColumnError)
      return new Response('Invalid export columns.', { status: 400, headers });
    throw error;
  }
  return new Response(csv, {
    headers: {
      ...headers,
      'content-type': 'text/csv; charset=utf-8',
      'content-disposition': `attachment; filename="${timelineExportFileName}"`,
    },
  });
}
