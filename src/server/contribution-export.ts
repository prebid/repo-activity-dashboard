import 'server-only';
import { z } from 'zod';
import {
  readReportingJson,
  reportingBodyLimit,
  reportingHeaders as headers,
} from '@/lib/auth/reporting-request';
import { requireViewer } from '@/lib/auth/viewer';
import { loadContributionData, loadContributionValues } from './contribution-data';
import {
  readContributionExportQuery,
  contributionCsv,
} from '@/lib/presentation/contribution-export';
import { selectContributionExport } from '@/lib/presentation/contributions';
import type { ContributionArea } from '@/models/contribution-page';
/**
 * Authenticated read-only download of prepared fake metrics; no reporting ingestion or database
 * access. The canonical and the legacy query are both served, never redirected, and never read a
 * preference cookie.
 */
export async function contributionExportResponse(
  request: Request,
  area: ContributionArea,
): Promise<Response> {
  await requireViewer();
  let query = new URL(request.url).search;
  if (request.method === 'POST') {
    const read = await readReportingJson(
      request,
      z.object({ query: z.string().max(reportingBodyLimit) }).strict(),
      (status) =>
        new Response(status === 415 ? 'Expected JSON.' : 'Invalid export options.', {
          status,
          headers,
        }),
    );
    if (!read.ok) return read.response;
    query = read.data.query;
  }
  const parsed = readContributionExportQuery(query, area);
  if (!parsed) return new Response('Invalid export options.', { status: 400, headers });
  const options = parsed.request;
  const loaded =
    parsed.form === 'canonical'
      ? await loadContributionValues(area, parsed.values, options.focus)
      : await loadContributionData(area, parsed.scope, options.focus);
  if (loaded.status !== 'ready')
    return new Response('Invalid report scope.', { status: 400, headers });
  const selected = selectContributionExport(loaded.source, loaded.settings.selection, options);
  return new Response(contributionCsv(selected.rows, options, selected.context), {
    headers: {
      ...headers,
      'content-type': 'text/csv; charset=utf-8',
      'content-disposition':
        'attachment; filename="' + area + '-' + options.layout + '-sample.csv"',
    },
  });
}
