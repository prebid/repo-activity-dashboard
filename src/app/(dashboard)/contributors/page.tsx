import { ContributionRoute } from '@/app/_screens/contribution-route';
import { encodeSearchParams, type PageSearchParams } from '@/lib/presentation/search-params';
import { contributionPageMetadata } from '@/server/page-metadata';
export async function generateMetadata({
  searchParams,
}: {
  searchParams: Promise<PageSearchParams>;
}) {
  return contributionPageMetadata(
    'contributors',
    new URLSearchParams(encodeSearchParams(await searchParams)),
  );
}
export default function Page({ searchParams }: { searchParams: Promise<PageSearchParams> }) {
  return <ContributionRoute area="contributors" searchParams={searchParams} />;
}
