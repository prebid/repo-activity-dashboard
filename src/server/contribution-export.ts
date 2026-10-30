import 'server-only';
import { z } from 'zod';
import { readBoundedBody, RequestBodyError } from '@/lib/auth/bounded-request';
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
  const headers = { 'cache-control': 'private, no-store', 'x-content-type-options': 'nosniff' };
  let params = new URL(request.url).searchParams;
  if (request.method === 'POST') {
    if (
      request.headers.get('content-type')?.split(';')[0].trim().toLowerCase() !== 'application/json'
    )
      return new Response('Expected JSON.', { status: 415, headers });
    try {
      const input = z
        .object({ query: z.string().max(64 * 1024) })
        .strict()
        .parse(JSON.parse(new TextDecoder().decode(await readBoundedBody(request, 64 * 1024))));
      params = new URLSearchParams(input.query);
    } catch (error) {
      return new Response('Invalid export options.', {
        status: error instanceof RequestBodyError ? error.status : 400,
        headers,
      });
    }
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
