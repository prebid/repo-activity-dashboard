import { notFound } from 'next/navigation';
import { ContributionRoute } from '@/app/_screens/contribution-route';
import { requireViewer } from '@/lib/auth/viewer';
import { decodeRouteSegment } from '@/lib/presentation/navigation';
import type { PageSearchParams } from '@/lib/presentation/search-params';
export default async function Page({
  params,
  searchParams,
}: {
  params: Promise<{ accountId: string }>;
  searchParams: Promise<PageSearchParams>;
}) {
  // Invalid identities must not skip the route's access boundary.
  await requireViewer();
  const accountId = decodeRouteSegment((await params).accountId);
  if (accountId === null) notFound();
  return (
    <ContributionRoute
      area="contributors"
      searchParams={searchParams}
      focus={{ kind: 'contributor', accountId }}
    />
  );
}
