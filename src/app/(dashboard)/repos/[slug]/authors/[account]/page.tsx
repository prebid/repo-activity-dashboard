import Link from 'next/link';
import { notFound } from 'next/navigation';
import { catalogRepository, repositoryAuthorDetail } from '@/server/reporting';
import { RepositoryPageScreen } from '@/app/_screens/repository-page-screen';
import { EmptyState } from '@/components/feedback/empty-state';
import type { PageSearchParams } from '@/lib/presentation/search-params';
import { readAuthorAccountSegment } from '@/lib/presentation/repository-author-records';
import { legacySearchParams } from '@/lib/presentation/url/codec';
import { repositoryAuthorPageMetadata } from '@/server/page-metadata';
import { readPreferences } from '@/server/preferences';
import { repositoryPagePreferences } from '@/app/_screens/repository-preferences';
import { BackIcon } from '@/components/ui/icons';
import { requireViewer } from '@/lib/auth/viewer';
import { canonicalPage } from '@/server/canonical-page';
import styles from '@/features/repositories/repository-page.module.css';

export async function generateMetadata({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string; account: string }>;
  searchParams: Promise<PageSearchParams>;
}) {
  const { slug, account } = await params;
  return repositoryAuthorPageMetadata(slug, account, legacySearchParams(await searchParams));
}

function InvalidAuthorView() {
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
}
export default async function AuthorRecordsPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string; account: string }>;
  searchParams: Promise<PageSearchParams>;
}) {
  await requireViewer();
  const { slug, account } = await params;
  if (!catalogRepository(slug)) notFound();
  // The route segment arrives percent-encoded; the helper writes the decoded account back.
  const author = readAuthorAccountSegment(account);
  if (author === null) return <InvalidAuthorView />;
  const page = await canonicalPage(
    '/repos/[slug]/authors/[account]',
    { slug: [slug], account: [author] },
    await searchParams,
  );
  if (page.status !== 'canonical') return <InvalidAuthorView />;
  const result = await repositoryAuthorDetail(slug, author, page.values);
  if (result.status === 'invalid') return <InvalidAuthorView />;
  return (
    <RepositoryPageScreen
      viewerId={result.viewer.id}
      source={result.source}
      navigation={result.navigation}
      preferences={repositoryPagePreferences(await readPreferences('repositories'), result.source)}
    />
  );
}
