'use client';
import { ContributionView, contributionColumns } from '@/features/contributions/contribution-view';
import { useTableController } from '@/lib/navigation/use-table-controller';
import type { ContributionRow } from '@/models/reporting';
const columnIds = contributionColumns.map((c) => c.id);
export function ContributionsScreen({
  title,
  rows,
  viewerId,
}: {
  title: string;
  rows: ContributionRow[];
  viewerId: string;
}) {
  const controller = useTableController({
    queryKey: 'report',
    scopeKey: title.toLowerCase(),
    viewerId,
    columnIds,
  });
  return (
    <ContributionView key={controller.scopeKey} title={title} rows={rows} controller={controller} />
  );
}
