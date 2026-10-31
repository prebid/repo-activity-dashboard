import 'server-only';
import { z } from 'zod';
import {
  readReportingJson,
  reportingBodyLimit,
  reportingHeaders as headers,
} from '@/lib/auth/reporting-request';
import { requireViewer } from '@/lib/auth/viewer';
import { loadContributionData } from './contribution-data';
import { readContributionExport, contributionCsv } from '@/lib/presentation/contribution-export';
import { selectContributionExport } from '@/lib/presentation/contributions';
import type { ContributionArea } from '@/models/contribution-page';
/** Authenticated read-only download of prepared fake metrics; no reporting ingestion or database access. */
export async function contributionExportResponse(
  request: Request,
  area: ContributionArea,
): Promise<Response> {
  await requireViewer();
  let params = new URL(request.url).searchParams;
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
    params = new URLSearchParams(read.data.query);
  }
  const options = readContributionExport(params, area);
  if (!options) return new Response('Invalid export options.', { status: 400, headers });
  const scope = new URLSearchParams(params);
  for (const key of [...scope.keys()])
    if (
      key === 'column' ||
      key === 'layout' ||
      key === 'entity' ||
      key === 'entityId' ||
      key.startsWith('export.')
    )
      scope.delete(key);
  const loaded = await loadContributionData(area, scope, options.focus);
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
