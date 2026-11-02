import { notFound } from 'next/navigation';
import { ContributionRoute } from '@/app/_screens/contribution-route';
import { requireViewer } from '@/lib/auth/viewer';
import { decodeRouteSegment } from '@/lib/presentation/navigation';
import { encodeSearchParams, type PageSearchParams } from '@/lib/presentation/search-params';
import { contributionPageMetadata } from '@/server/page-metadata';
import { canonicalPage } from '@/server/canonical-page';
export async function generateMetadata({
  params,
  searchParams,
}: {
  params: Promise<{ accountId: string }>;
  searchParams: Promise<PageSearchParams>;
}) {
  const accountId = decodeRouteSegment((await params).accountId);
  return contributionPageMetadata(
    'contributors',
    new URLSearchParams(encodeSearchParams(await searchParams)),
    accountId === null ? null : { kind: 'contributor', accountId },
  );
}
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
  // These screens still read legacy keys: the helper answers nothing until they read codec values.
  await canonicalPage('/contributors/[accountId]', { accountId: [accountId] }, await searchParams, {
    legacyScreens: true,
  });
  return (
    <ContributionRoute
      area="contributors"
      searchParams={searchParams}
      focus={{ kind: 'contributor', accountId }}
    />
  );
}
