import { notFound } from 'next/navigation';
import { ContributionRoute } from '@/app/_screens/contribution-route';
import { companyFocus } from '@/lib/presentation/contribution-navigation';
import { decodeRouteSegment } from '@/lib/presentation/navigation';
import { requireViewer } from '@/lib/auth/viewer';
import { encodeSearchParams, type PageSearchParams } from '@/lib/presentation/search-params';
import { contributionPageMetadata } from '@/server/page-metadata';
function focusFrom(identity: string[]) {
  const segments = identity.map(decodeRouteSegment);
  return segments.includes(null) ? null : companyFocus(segments as string[]);
}
export async function generateMetadata({
  params,
  searchParams,
}: {
  params: Promise<{ identity: string[] }>;
  searchParams: Promise<PageSearchParams>;
}) {
  return contributionPageMetadata(
    'companies',
    new URLSearchParams(encodeSearchParams(await searchParams)),
    focusFrom((await params).identity),
  );
}
export default async function Page({
  params,
  searchParams,
}: {
  params: Promise<{ identity: string[] }>;
  searchParams: Promise<PageSearchParams>;
}) {
  // Invalid identities must not skip the route's access boundary.
  await requireViewer();
  const focus = focusFrom((await params).identity);
  if (!focus) notFound();
  return <ContributionRoute area="companies" searchParams={searchParams} focus={focus} />;
}
