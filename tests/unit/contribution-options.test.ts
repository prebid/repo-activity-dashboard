import { expect, it } from 'vitest';
import { contributionDirectorySample, contributionSample } from '@/mocks/contributions';
import { selectContributionChoices } from '@/lib/presentation/contribution-options';
it('uses the same identities as the report without building records and pages choices at 50', () => {
  for (const sample of ['reference', 'large', 'missing', 'empty', 'partial'] as const)
    expect(contributionDirectorySample(sample).accounts).toEqual(
      contributionSample({ scenario: sample }).accounts,
    );
  const directory = contributionDirectorySample('large');
  const first = selectContributionChoices(directory, {
    kind: 'accounts',
    search: '',
    page: 0,
    selectedIds: null,
  });
  expect(first.total).toBe(251);
  expect(first.choices).toHaveLength(50);
  const last = selectContributionChoices(directory, {
    kind: 'accounts',
    search: '',
    page: 999,
    selectedIds: null,
  });
  expect(last.page).toBe(5);
  expect(last.choices).toHaveLength(1);
  expect(last.choices[0].value).toBe('account-heavy-agent');
});
it('searches the full directory and retains selection independently of paging', () => {
  const directory = contributionDirectorySample('large');
  const selected = ['account-person-001', 'account-heavy-agent'];
  const result = selectContributionChoices(directory, {
    kind: 'accounts',
    search: 'HEAVY',
    page: 0,
    selectedIds: selected,
  });
  expect(result.total).toBe(1);
  expect(result.choices[0].value).toBe('account-heavy-agent');
  expect(selected).toEqual(['account-person-001', 'account-heavy-agent']);
  expect(
    selectContributionChoices(directory, { kind: 'accounts', search: '', page: 2, selectedIds: [] })
      .choices,
  ).toEqual([]);
  expect(
    selectContributionChoices(directory, {
      kind: 'companies',
      search: '',
      page: 0,
      selectedIds: [''],
    }).choices,
  ).toEqual([{ value: '', label: 'Unmapped company' }]);
  expect(
    selectContributionChoices(directory, {
      kind: 'companies',
      search: 'no match',
      page: 3,
      selectedIds: null,
    }),
  ).toEqual({ choices: [], total: 0, page: 0 });
  expect(() => contributionDirectorySample('bad' as never)).toThrow('Unknown');
});
