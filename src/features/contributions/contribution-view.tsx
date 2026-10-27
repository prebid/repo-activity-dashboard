'use client';
import type { TableController } from '@/lib/presentation/table-controller';
import { DataTable, type DataColumn } from '@/components/tables/data-table';
import type { ContributionRow } from '@/models/reporting';
export const contributionColumns: DataColumn<ContributionRow>[] = [
  { id: 'name', label: 'Name', value: (r) => r.name },
  { id: 'company', label: 'Company / attribution', value: (r) => r.company },
  { id: 'authored', label: 'PRs authored', value: (r) => r.authored },
  { id: 'feedback', label: 'Feedback contributions', value: (r) => r.feedback },
  { id: 'approvals', label: 'Approval contributions', value: (r) => r.approvals },
  { id: 'merges', label: 'Merges performed', value: (r) => r.merges },
  { id: 'issues', label: 'Issues authored', value: (r) => r.issues },
];
export function ContributionView({
  title,
  rows,
  controller,
}: {
  title: string;
  rows: ContributionRow[];
  controller: TableController;
}) {
  return (
    <>
      <div>
        <h1 className="text-3xl font-semibold">{title}</h1>
        <p className="mt-2 text-muted-foreground">
          Prepared contribution scenario · October 2026 · Current company mapping
        </p>
      </div>
      <DataTable
        title={title}
        rows={rows}
        columns={contributionColumns}
        controller={controller}
        exportName={title.toLowerCase() + '.csv'}
      />
    </>
  );
}
