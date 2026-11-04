import { ContributionRoute } from '@/app/_screens/contribution-route';
import type { PageSearchParams } from '@/lib/presentation/search-params';
import { legacySearchParams } from '@/lib/presentation/url/codec';
import { contributionPageMetadata } from '@/server/page-metadata';
import { contributionQueryLens } from '@/lib/presentation/page-title';
import { requireViewer } from '@/lib/auth/viewer';
import { canonicalPage } from '@/server/canonical-page';
import { contributionPageOptions } from '@/server/contribution-preferences';
export async function generateMetadata({
  searchParams,
}: {
  searchParams: Promise<PageSearchParams>;
}) {
  const params = legacySearchParams(await searchParams);
  // The route is the Reviewers lens, except that an address naming the Companies lens is read in
  // it, as the invalid view and the masthead read it.
  const lens = contributionQueryLens(params) === 'all' ? 'all' : 'reviewers';
  return contributionPageMetadata('contributors', params, { kind: 'overview' }, lens);
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
  return <ContributionRoute area="contributors" lens="reviewers" page={page} query={query} />;
}
