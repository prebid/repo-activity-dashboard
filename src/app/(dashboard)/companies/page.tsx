import { ContributionRoute } from '@/app/_screens/contribution-route';
import { encodeSearchParams, type PageSearchParams } from '@/lib/presentation/search-params';
import { contributionPageMetadata } from '@/server/page-metadata';
import { requireViewer } from '@/lib/auth/viewer';
import { canonicalPage } from '@/server/canonical-page';
export async function generateMetadata({
  searchParams,
}: {
  searchParams: Promise<PageSearchParams>;
}) {
  return contributionPageMetadata(
    'companies',
    new URLSearchParams(encodeSearchParams(await searchParams)),
  );
}
export default async function Page({ searchParams }: { searchParams: Promise<PageSearchParams> }) {
  await requireViewer();
  // These screens still read legacy keys: the helper answers nothing until they read codec values.
  await canonicalPage('/companies', {}, await searchParams, { legacyScreens: true });
  return <ContributionRoute area="companies" searchParams={searchParams} />;
}
