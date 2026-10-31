import { notFound } from 'next/navigation';
import { ContributionRoute } from '@/app/_screens/contribution-route';
import { companyFocus } from '@/lib/presentation/contribution-navigation';
import { decodeRouteSegment } from '@/lib/presentation/navigation';
import { requireViewer } from '@/lib/auth/viewer';
import type { PageSearchParams } from '@/lib/presentation/search-params';
export default async function Page({
  params,
  searchParams,
}: {
  params: Promise<{ identity: string[] }>;
  searchParams: Promise<PageSearchParams>;
}) {
  // Invalid identities must not skip the route's access boundary.
  await requireViewer();
  const segments = (await params).identity.map(decodeRouteSegment);
  const focus = segments.includes(null) ? null : companyFocus(segments as string[]);
  if (!focus) notFound();
  return <ContributionRoute area="companies" searchParams={searchParams} focus={focus} />;
}
