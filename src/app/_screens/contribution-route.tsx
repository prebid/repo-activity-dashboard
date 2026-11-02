import Link from 'next/link';
import { redirect } from 'next/navigation';
import { contributions } from '@/server/reporting';
import { readPreferences } from '@/server/preferences';
import { resolveContributionReport } from '@/server/contribution-preferences';
import { contributionPath } from '@/lib/presentation/contribution-navigation';
import { contributionSubjectTitle } from '@/lib/presentation/page-title';
import { encodeSearchParams, type PageSearchParams } from '@/lib/presentation/search-params';
import type { ContributionArea } from '@/models/contribution-page';
import type { ContributionFocus } from '@/models/contributions';
import { EmptyState } from '@/components/feedback/empty-state';
import { PageHeader } from '@/components/navigation/page-header';
import { ContributionsScreen } from './contributions-screen';
import { ContributionTimelineRoute } from './timeline-route';

export async function ContributionRoute({
  area,
  searchParams,
  focus,
}: {
  area: ContributionArea;
  searchParams: Promise<PageSearchParams>;
  focus?: ContributionFocus;
}) {
  const params = new URLSearchParams(encodeSearchParams(await searchParams));
  if (params.has('timeline'))
    return <ContributionTimelineRoute area={area} params={params} focus={focus} />;
  const result = await contributions(area, params, focus);
  if (result.status === 'invalid')
    return (
      <>
        {/* No report loaded, so the header states no snapshot time. */}
        <PageHeader title={contributionSubjectTitle(area, 'overview')} asOf="" />
        <EmptyState kind="error" title="Invalid contribution view">
          This link contains an unsupported view, date range or filter identity.{' '}
          <Link href={'/' + area}>Open {area}</Link>
        </EmptyState>
      </>
    );
  // An entry with a saved scope is answered with a redirect to its explicit-scope URL, so the
  // report renders once and never rewrites its address.
  const entry = resolveContributionReport(await readPreferences('contributions'), {
    path: contributionPath(focus && focus.kind !== 'overview' ? focus : area),
    params,
    page: result.page,
  });
  if (entry.status === 'redirect') redirect(entry.href);
  return (
    <ContributionsScreen
      page={result.page}
      viewerId={result.viewer.id}
      directory={result.directory}
      preferences={entry.preferences}
    />
  );
}
