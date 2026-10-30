import { ContributionRoute } from '@/app/_screens/contribution-route';
import type { PageSearchParams } from '@/lib/presentation/search-params';
export default function Page({ searchParams }: { searchParams: Promise<PageSearchParams> }) {
  return <ContributionRoute area="contributors" searchParams={searchParams} />;
}
