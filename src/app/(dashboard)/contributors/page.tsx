import { ContributionView } from '@/features/contributions/contribution-view';
import { contributionRows } from '@/mocks/reporting';
import { encodeSearchParams } from '@/lib/presentation/search-params';
export default async function ContributorsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  return (
    <ContributionView
      title="Contributors"
      rows={contributionRows}
      initialSearch={encodeSearchParams(await searchParams)}
    />
  );
}
