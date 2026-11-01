import { expect, it } from 'vitest';
import {
  recordIssueColumns,
  recordPrColumns,
} from '@/features/repositories/repository-records-view';

it('gives record author columns room for a typical handle and its external-link icon', () => {
  for (const columns of [recordPrColumns, recordIssueColumns])
    expect(columns.find((column) => column.id === 'author')?.width).toBe(200);
});
