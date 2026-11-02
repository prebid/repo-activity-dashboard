import { notFound } from 'next/navigation';
import { ContributionRoute } from '@/app/_screens/contribution-route';
import { companyFocus } from '@/lib/presentation/contribution-navigation';
import { decodeRouteSegment } from '@/lib/presentation/navigation';
import { requireViewer } from '@/lib/auth/viewer';
import type { PageSearchParams } from '@/lib/presentation/search-params';
import { legacySearchParams } from '@/lib/presentation/url/codec';
import { contributionPageMetadata } from '@/server/page-metadata';
import { canonicalPage } from '@/server/canonical-page';
import { contributionPageOptions } from '@/server/contribution-preferences';
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
    legacySearchParams(await searchParams),
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
  const { identity } = await params;
  const focus = focusFrom(identity);
  if (!focus) notFound();
  const query = await searchParams;
  const segments = {
    identity: identity.map((segment) => decodeRouteSegment(segment) ?? segment),
  };
  const page = await canonicalPage(
    '/companies/[...identity]',
    segments,
    query,
    contributionPageOptions('/companies/[...identity]', segments),
  );
  return <ContributionRoute area="companies" page={page} focus={focus} />;
}
