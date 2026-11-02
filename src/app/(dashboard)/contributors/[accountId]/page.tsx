import { notFound } from 'next/navigation';
import { ContributionRoute } from '@/app/_screens/contribution-route';
import { requireViewer } from '@/lib/auth/viewer';
import { decodeRouteSegment } from '@/lib/presentation/navigation';
import type { PageSearchParams } from '@/lib/presentation/search-params';
import { legacySearchParams } from '@/lib/presentation/url/codec';
import { contributionPageMetadata } from '@/server/page-metadata';
import { canonicalPage } from '@/server/canonical-page';
import { contributionPageOptions } from '@/server/contribution-preferences';
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
    legacySearchParams(await searchParams),
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
  const query = await searchParams;
  const segments = { accountId: [accountId] };
  const page = await canonicalPage(
    '/contributors/[accountId]',
    segments,
    query,
    contributionPageOptions('/contributors/[accountId]', segments, query),
  );
  return (
    <ContributionRoute area="contributors" page={page} focus={{ kind: 'contributor', accountId }} />
  );
}
