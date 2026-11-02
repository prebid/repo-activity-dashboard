import { ContributionRoute } from '@/app/_screens/contribution-route';
import type { PageSearchParams } from '@/lib/presentation/search-params';
import { legacySearchParams } from '@/lib/presentation/url/codec';
import { contributionPageMetadata } from '@/server/page-metadata';
import { requireViewer } from '@/lib/auth/viewer';
import { canonicalPage } from '@/server/canonical-page';
import { contributionPageOptions } from '@/server/contribution-preferences';
export async function generateMetadata({
  searchParams,
}: {
  searchParams: Promise<PageSearchParams>;
}) {
  return contributionPageMetadata(
    'contributors',
    legacySearchParams(await searchParams),
    { kind: 'overview' },
    'reviewers',
  );
}
/** The Reviewers lens's people overview: the contributions report of reviewer activity. */
export default async function Page({ searchParams }: { searchParams: Promise<PageSearchParams> }) {
  await requireViewer();
  const query = await searchParams;
  const page = await canonicalPage(
    '/reviewers',
    {},
    query,
    contributionPageOptions('/reviewers', {}),
  );
  return <ContributionRoute area="contributors" lens="reviewers" page={page} />;
}
