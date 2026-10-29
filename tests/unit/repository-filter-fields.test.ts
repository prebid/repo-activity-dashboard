import { expect, expectTypeOf, it } from 'vitest';
import { ZodError } from 'zod';
import {
  repositoryFilterFields,
  repositoryFilterValue,
  removeRepositoryFilter,
  repositoryFilterChips,
  repositoryFilterErrorMessage,
  type RepositoryPrFilterField,
  type RepositoryIssueFilterField,
  type RepositoryFilterKey,
} from '@/features/repositories/repository-filter-fields';
import { repositoryPageFiltersSchema } from '@/models/repository-page';
import { repositoryPageSample } from '@/mocks/repository-page';
import { repositoryOverviewSamples } from '@/mocks/repository-overview';
const samples = repositoryOverviewSamples(),
  repo = samples.repositories[0].repository;
const prs = repositoryPageSample(repo, {
  selection: { scope: 'current', metric: 'totalOpenPrs' },
  returnTo: '/repos',
});
const issues = repositoryPageSample(repo, {
  selection: { scope: 'current', metric: 'openIssues' },
  returnTo: '/repos',
});
it('binds registry keys and multiplicity to the list schemas at compile time', () => {
  expectTypeOf<'labels'>().toExtend<RepositoryFilterKey>();
  expectTypeOf<'lables'>().not.toExtend<RepositoryFilterKey>();
  expectTypeOf<'approvals'>().not.toExtend<RepositoryIssueFilterField['key']>();
  expectTypeOf<'assignees'>().not.toExtend<RepositoryPrFilterField['key']>();
  expectTypeOf<
    Extract<RepositoryPrFilterField, { key: 'authors' }>['multiple']
  >().toEqualTypeOf<true>();
  expectTypeOf<
    Extract<RepositoryIssueFilterField, { key: 'assignment' }>['multiple']
  >().toEqualTypeOf<false | undefined>();
});
it('keeps field order/labels and separates PR, issue and period controls', () => {
  const p = repositoryFilterFields(prs),
    i = repositoryFilterFields(issues);
  expect(p.map((f) => f.key)).toEqual([
    'labels',
    'authors',
    'authorTypes',
    'latestActors',
    'ageBand',
    'states',
    'draft',
    'branches',
    'reviewers',
    'approvals',
    'agentReviewer',
    'botReviewer',
  ]);
  expect(i.map((f) => f.key)).toEqual([
    'labels',
    'authors',
    'authorTypes',
    'latestActors',
    'ageBand',
    'states',
    'assignees',
    'assignment',
  ]);
  expect(i.find((f) => f.key === 'states')!.options.map((x) => x.value)).toEqual([
    'Closed',
    'Open',
  ]);
  const historical = {
    ...prs,
    drilldown: {
      ...prs.drilldown,
      selection: {
        scope: 'period' as const,
        metric: 'prsOpened' as const,
        range: samples.periods[0].period.range,
      },
    },
  };
  expect(repositoryFilterFields(historical).map((f) => f.key)).toEqual([
    'labels',
    'authors',
    'authorTypes',
    'latestActors',
    'states',
    'draft',
    'branches',
  ]);
  expect(new Set(p.map((f) => f.key)).size).toBe(p.length);
});
it('reads and removes typed scalar/array fields without losing unrelated filters', () => {
  const p = repositoryPageFiltersSchema.parse({
    kind: 'prs',
    authors: ['sample-alice', 'sample-bob'],
    draft: 'drafts',
    ageBand: 0,
    branches: ['master'],
    reviewers: '0',
    approvals: '1',
    agentReviewer: 'yes',
    botReviewer: 'no',
  });
  expect(removeRepositoryFilter(p, 'authors', 'sample-alice')).toMatchObject({
    authors: ['sample-bob'],
    draft: 'drafts',
    approvals: '1',
  });
  expect(removeRepositoryFilter(p, 'draft', 'drafts')).toMatchObject({
    draft: 'all',
    authors: p.authors,
  });
  expect(removeRepositoryFilter(p, 'ageBand', '0').ageBand).toBeUndefined();
  if (p.kind !== 'prs') throw Error('Expected PR filters');
  for (const key of [
    'draft',
    'branches',
    'reviewers',
    'approvals',
    'agentReviewer',
    'botReviewer',
  ] as const)
    expect(repositoryFilterValue(p, key)).toEqual(p[key]);
  const i = repositoryPageFiltersSchema.parse({
    kind: 'issues',
    assignment: 'unassigned',
    assignees: ['sample-alice'],
  });
  expect(repositoryFilterValue(i, 'assignees')).toEqual(['sample-alice']);
  expect(repositoryFilterValue(i, 'assignment')).toBe('unassigned');
  expect(repositoryFilterValue(i, 'approvals')).toBeUndefined();
  expect(repositoryFilterValue(p, 'assignment')).toBeUndefined();
  expect(removeRepositoryFilter(i, 'assignment', 'unassigned')).toMatchObject({
    assignment: 'any',
  });
  expect(
    repositoryFilterChips(p, repositoryFilterFields(prs)).some(
      (chip) => chip.label === 'Age: Up to 30 days',
    ),
  ).toBe(true);
  expect(
    repositoryFilterChips(
      repositoryPageFiltersSchema.parse({ kind: 'issues' }),
      repositoryFilterFields(issues),
    ),
  ).toEqual([]);
  const unknownLabel = repositoryPageFiltersSchema.parse({
    kind: 'prs',
    labels: ['not-in-sample'],
  });
  expect(repositoryFilterChips(unknownLabel, repositoryFilterFields(prs))[0].label).toBe(
    'Labels: not-in-sample',
  );
});
it('reports the failing field and distinguishes array limits from invalid scalar/string values', () => {
  const fields = repositoryFilterFields(prs);
  const error = (value: unknown) => {
    const result = repositoryPageFiltersSchema.safeParse(value);
    if (result.success) throw Error('Expected invalid filters');
    return result.error;
  };
  expect(
    repositoryFilterErrorMessage(
      error({ kind: 'prs', authors: Array(101).fill('sample-alice') }),
      fields,
    ),
  ).toBe('Authors: select at most 100 options.');
  expect(repositoryFilterErrorMessage(error({ kind: 'prs', draft: 'invalid' }), fields)).toBe(
    'Choose a valid value for draft status.',
  );
  expect(
    repositoryFilterErrorMessage(error({ kind: 'prs', labels: ['x'.repeat(101)] }), fields),
  ).toBe('Choose a valid value for labels.');
  expect(repositoryFilterErrorMessage(error({ kind: 'prs', retiredKey: [] }), fields)).toBe(
    'These filters could not be applied. Check your selections.',
  );
  expect(repositoryFilterErrorMessage(new ZodError([]), fields)).toBe(
    'These filters could not be applied. Check your selections.',
  );
});
