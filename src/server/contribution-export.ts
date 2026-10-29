import 'server-only';
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
  const params = new URL(request.url).searchParams;
  const options = readContributionExport(params, area);
  const headers = { 'cache-control': 'private, no-store', 'x-content-type-options': 'nosniff' };
  if (!options) return new Response('Invalid export options.', { status: 400, headers });
  const loaded = await loadContributionData(area, params, options.focus);
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
