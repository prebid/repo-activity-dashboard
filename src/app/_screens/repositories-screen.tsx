'use client';
import {
  AllRepositoriesView,
  repositorySummaryColumns,
} from '@/features/repositories/all-repositories-view';
import { useTableController } from '@/lib/navigation/use-table-controller';
import type { RepositorySummaryRow } from '@/models/reporting';
const columnIds = repositorySummaryColumns.map((c) => c.id);
export function RepositoriesScreen({
  viewerId,
  ...data
}: {
  viewerId: string;
  rows: RepositorySummaryRow[];
  asOfLabel: string;
}) {
  const controller = useTableController({
    queryKey: 'repos',
    scopeKey: 'all-repositories',
    viewerId,
    columnIds,
  });
  return <AllRepositoriesView key={controller.scopeKey} {...data} controller={controller} />;
}
