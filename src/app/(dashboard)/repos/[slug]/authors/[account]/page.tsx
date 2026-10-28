import Link from 'next/link';
import { repositoryAuthorDetail } from '@/server/reporting';
import { RepositoryRecordsScreen } from '@/app/_screens/repository-records-screen';
import { PageState } from '@/components/feedback/page-state';
import { encodeSearchParams, type PageSearchParams } from '@/lib/presentation/search-params';

export default async function AuthorRecordsPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string; account: string }>;
  searchParams: Promise<PageSearchParams>;
}) {
  const { slug, account } = await params;
  const query = new URLSearchParams(encodeSearchParams(await searchParams));
  const result = await repositoryAuthorDetail(slug, account, query);
  if (result.status === 'invalid')
    return (
      <>
        <Link prefetch={false} href="/repos" className="text-sm underline">
          All repositories
        </Link>
        <PageState title="Invalid author filter">
          Choose an author from a PR or issue author list for the selected period.
        </PageState>
      </>
    );
  return <RepositoryRecordsScreen viewerId={result.viewer.id} list={result.list} />;
}
