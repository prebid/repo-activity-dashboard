import Link from 'next/link';
import { contributions } from '@/server/reporting';
import { contributionSubjectTitle } from '@/lib/presentation/page-title';
import { encodeSearchParams, type PageSearchParams } from '@/lib/presentation/search-params';
import type { ContributionArea } from '@/models/contribution-page';
import type { ContributionFocus } from '@/models/contributions';
import { EmptyState } from '@/components/feedback/empty-state';
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
        <h1>{contributionSubjectTitle(area, 'overview')}</h1>
        <EmptyState kind="error" title="Invalid contribution view">
          This link contains an unsupported view, date range or filter identity.{' '}
          <Link href={'/' + area}>Open {area}</Link>
        </EmptyState>
      </>
    );
  return (
    <ContributionsScreen
      page={result.page}
      viewerId={result.viewer.id}
      directory={result.directory}
    />
  );
}
