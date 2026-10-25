import { ContributionView } from '@/features/contributions/contribution-view';
import { contributionRows } from '@/mocks/reporting';
import { encodeSearchParams, type PageSearchParams } from '@/lib/presentation/search-params';
export default async function ContributorsPage({
  searchParams,
}: {
  searchParams: Promise<PageSearchParams>;
}) {
  return (
    <ContributionView
      title="Contributors"
      rows={contributionRows}
      initialSearch={encodeSearchParams(await searchParams)}
    />
  );
}
