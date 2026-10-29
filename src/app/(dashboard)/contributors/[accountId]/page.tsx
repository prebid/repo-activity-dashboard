import { ContributionRoute } from '@/app/_screens/contribution-route';
import type { PageSearchParams } from '@/lib/presentation/search-params';
export default async function Page({
  params,
  searchParams,
}: {
  params: Promise<{ accountId: string }>;
  searchParams: Promise<PageSearchParams>;
}) {
  const { accountId } = await params;
  return (
    <ContributionRoute
      area="contributors"
      searchParams={searchParams}
      focus={{ kind: 'contributor', accountId }}
    />
  );
}
