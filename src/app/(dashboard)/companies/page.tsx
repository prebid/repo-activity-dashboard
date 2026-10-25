import { ContributionView } from '@/features/contributions/contribution-view';
import { companyRows } from '@/mocks/reporting';
import { encodeSearchParams, type PageSearchParams } from '@/lib/presentation/search-params';
export default async function CompaniesPage({
  searchParams,
}: {
  searchParams: Promise<PageSearchParams>;
}) {
  return (
    <ContributionView
      title="Companies"
      rows={companyRows}
      initialSearch={encodeSearchParams(await searchParams)}
    />
  );
}
