import Link from 'next/link';
import { contributions } from '@/server/reporting';
import { encodeSearchParams, type PageSearchParams } from '@/lib/presentation/search-params';
import type { ContributionArea } from '@/models/contribution-page';
import type { ContributionFocus } from '@/models/contributions';
import { PageState } from '@/components/feedback/page-state';
import { ContributionsScreen } from './contributions-screen';

export async function ContributionRoute({
  area,
  searchParams,
  focus,
}: {
  area: ContributionArea;
  searchParams: Promise<PageSearchParams>;
  focus?: ContributionFocus;
}) {
  const result = await contributions(
    area,
    new URLSearchParams(encodeSearchParams(await searchParams)),
    focus,
  );
  if (result.status === 'invalid')
    return (
      <>
        <h1>{area === 'contributors' ? 'Contributors' : 'Companies'}</h1>
        <PageState title="Invalid contribution view">
          This link contains an unsupported view, date range or filter identity.{' '}
          <Link href={'/' + area}>Open {area}</Link>
        </PageState>
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
