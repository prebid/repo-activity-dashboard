import { expect, it } from 'vitest';
import { appliesSavedScope, entryCookie, entryValues } from '@/lib/presentation/url/entry';

const scope = { period: 'last-month', repo: ['prebidjs'], type: ['human'] };

it('applies saved scope and presentation on list-route entries', () => {
  expect(
    entryValues(
      '/repos',
      {},
      { scope: { ...scope, age: ['30'] }, presentation: { bsort: 'name' } },
    ),
  ).toEqual({ period: 'last-month', repo: ['prebidjs'], bsort: 'name' });
  expect(
    entryValues(
      '/companies',
      { timeline: true },
      { scope, presentation: { group: 'week', sort: 'period' } },
    ),
  ).toEqual({
    timeline: true,
    period: 'last-month',
    repo: ['prebidjs'],
    type: ['human'],
    group: 'week',
  });
  expect(appliesSavedScope('/contributors')).toBe(true);
});

it('applies saved scope and the Reviewers lens presentation on a /reviewers entry', () => {
  expect(
    entryValues(
      '/reviewers',
      {},
      {
        scope,
        presentation: { sort: '-reviewerContributions', cols: ['prComments'], all: true },
      },
    ),
  ).toEqual({ ...scope, cols: ['prComments'], all: true });
  expect(
    entryValues('/companies', { lens: 'reviewers' }, { scope, presentation: { all: true } }),
  ).toEqual({ lens: 'reviewers', ...scope, all: true });
  // Saved presentation never adds `all` where the route rejects it.
  expect(entryValues('/contributors', {}, { presentation: { all: true } })).toEqual({});
  expect(appliesSavedScope('/reviewers')).toBe(true);
  expect(entryCookie('/reviewers')).toBe('contributions');
});

it('applies only saved presentation on detail routes (decision C2)', () => {
  expect(
    entryValues(
      '/contributors/[accountId]',
      {},
      { scope, presentation: { sort: 'prsAuthored', cols: ['mergesPerformed'] } },
    ),
  ).toEqual({ sort: 'prsAuthored', cols: ['mergesPerformed'] });
  expect(
    entryValues(
      '/repos/[slug]',
      { view: 'issues' },
      { presentation: { sort: '-createdAt', charts: true } },
    ),
  ).toEqual({ view: 'issues', charts: true });
  expect(appliesSavedScope('/companies/[...identity]')).toBe(false);
});

it('never lets saved values replace selectors, return context or the version', () => {
  expect(
    entryValues(
      '/repos',
      { timeline: true, back: ['-'] },
      {
        presentation: {
          timeline: true,
          sample: 'mixed',
          back: ['!'],
          v: '1',
          bsort: 'name',
          group: 'week',
        },
      },
    ),
  ).toEqual({ timeline: true, back: ['-'], group: 'week' });
  expect(entryValues('/repos', { age: [] }, { scope: { age: ['60'] } })).toEqual({ age: [] });
  expect(entryValues('/repos', {}, {})).toEqual({});
  expect(entryCookie('/repos/[slug]')).toBe('repositories');
  expect(entryCookie('/reviewers')).toBe('contributions');
});
