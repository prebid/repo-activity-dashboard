import Link from 'next/link';
import { repositoryAuthorDetail } from '@/server/reporting';
import { RepositoryPageScreen } from '@/app/_screens/repository-page-screen';
import { EmptyState } from '@/components/feedback/empty-state';
import { encodeSearchParams, type PageSearchParams } from '@/lib/presentation/search-params';
import { repositoryAuthorPageMetadata } from '@/server/page-metadata';
import { readPreferences } from '@/server/preferences';
import { repositoryPagePreferences } from '@/app/_screens/repository-preferences';
import { BackIcon } from '@/components/ui/icons';
import styles from '@/features/repositories/repository-page.module.css';

export async function generateMetadata({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string; account: string }>;
  searchParams: Promise<PageSearchParams>;
}) {
  const { slug, account } = await params;
  return repositoryAuthorPageMetadata(
    slug,
    account,
    new URLSearchParams(encodeSearchParams(await searchParams)),
  );
}

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
        <Link prefetch={false} href="/repos" className={styles.backLink}>
          <BackIcon size={14} />
          All repositories
        </Link>
        <EmptyState kind="error" title="Invalid author filter">
          Choose an author from a PR or issue author list for the selected period.
        </EmptyState>
      </>
    );
  return (
    <RepositoryPageScreen
      viewerId={result.viewer.id}
      source={result.source}
      navigation={result.navigation}
      preferences={repositoryPagePreferences(await readPreferences('repositories'), result.source)}
    />
  );
}
