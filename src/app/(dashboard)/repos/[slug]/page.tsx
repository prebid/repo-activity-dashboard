import { repositoryDetail } from '@/server/reporting';
import { RepositoryPageScreen } from '@/app/_screens/repository-page-screen';
import { RepositoryInsightsScreen } from '@/app/_screens/repository-insights-screen';
import { PageState } from '@/components/feedback/page-state';
import Link from 'next/link';
import { encodeSearchParams, type PageSearchParams } from '@/lib/presentation/search-params';
export default async function RepositoryPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<PageSearchParams>;
}) {
  const { slug } = await params;
  const query = await searchParams;
  const result = await repositoryDetail(slug, new URLSearchParams(encodeSearchParams(query)));
  if (result.status === 'page')
    return (
      <RepositoryPageScreen
        viewerId={result.viewer.id}
        source={result.source}
        navigation={result.navigation}
      />
    );
  if (result.status === 'insight')
    return (
      <RepositoryInsightsScreen
        viewerId={result.viewer.id}
        insight={result.insight}
        navigation={result.navigation}
      />
    );
  if (result.status === 'invalid' || result.status === 'unsupported')
    return (
      <>
        <Link
          prefetch={false}
          href={result.status === 'unsupported' ? result.returnTo : '/repos'}
          className="text-sm underline"
        >
          All repositories
        </Link>
        <PageState
          title={
            result.status === 'invalid'
              ? 'Invalid repository filter'
              : 'This drilldown is not available yet'
          }
        >
          {result.status === 'invalid'
            ? 'The requested metric, dates, branch, or return path is invalid. Choose a count from All repositories.'
            : 'Choose another metric from All repositories.'}
        </PageState>
      </>
    );
  const unhandled: never = result;
  return unhandled;
}
