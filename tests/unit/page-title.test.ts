import { describe, expect, it } from 'vitest';
import {
  contributionPageTitle,
  contributionSubjectTitle,
  defaultPageTitle,
  repositoriesPageTitle,
  repositoryAuthorPageTitle,
  repositoryPageTitle,
} from '@/lib/presentation/page-title';
import { repositoryMetricName } from '@/lib/presentation/repository-metric-text';
import { reportMetricLabel } from '@/models/contribution-metrics';

const prebidjs = {
  id: 'repo-prebidjs',
  slug: 'prebidjs',
  name: 'Prebid.js',
  primaryBranch: 'master',
} as const;
const range = 'from=2026-01-01T00:00:00.000Z&to=2026-10-24T12:00:00.000Z&inclusive=1';
const query = (search: string) => new URLSearchParams(search);
const alice = { name: 'Alice' };
const acme = { name: 'Example Acme' };

it('defaults to the product name', () => {
  expect(defaultPageTitle).toBe('Prebid');
});

describe('contributionSubjectTitle', () => {
  it.each([
    ['contributors', 'overview', 'Contributors'],
    ['companies', 'overview', 'Companies'],
    ['contributors', alice, 'Alice'],
    ['companies', acme, 'Example Acme'],
    ['companies', null, 'Unmapped company'],
  ] as const)('names %s %o as %s', (area, subject, title) => {
    expect(contributionSubjectTitle(area, subject)).toBe(title);
  });
});

describe('repositoriesPageTitle', () => {
  it('names the Summary and Timeline views', () => {
    expect(repositoriesPageTitle(query(''))).toBe('All repositories');
    expect(repositoriesPageTitle(query('timeline=1&timeline.group=week'))).toBe(
      'Timeline · All repositories',
    );
  });
});

describe('repositoryPageTitle', () => {
  it.each([
    ['', 'Prebid.js'],
    ['view=prs', 'Prebid.js'],
    ['scope=current&metric=totalOpenPrs', 'Prebid.js'],
    ['view=issues', 'Open issues · Prebid.js'],
    ['scope=current&metric=openIssues', 'Open issues · Prebid.js'],
    ['scope=current&metric=humanApprovals0', 'PRs with 0 human approvals · Prebid.js'],
    ['scope=current&metric=agedPrs&age=30', 'PRs older than 30 days · Prebid.js'],
    ['scope=period&metric=prsOpened&' + range, 'PRs opened during the period · Prebid.js'],
    ['scope=period&metric=prAuthors&' + range, 'PR authors · Prebid.js'],
    [
      'scope=period&metric=medianMergeDays&branch=master&' + range,
      'Merge-duration details · Prebid.js',
    ],
    ['timeline=1', 'Timeline · Prebid.js'],
    ['timeline=1&timeline.kind=issues&timeline.group=week', 'Timeline · Prebid.js'],
    [
      'timeline=1&timeline.detail=prsOpened',
      repositoryMetricName('prsOpened') + ' · Timeline · Prebid.js',
    ],
    ['timeline=1&timeline.detail=constructor', 'Timeline · Prebid.js'],
    ['view=bogus', 'Prebid.js'],
    ['scope=current&metric=unknown', 'Prebid.js'],
  ])('titles ?%s as %s', (search, title) => {
    expect(repositoryPageTitle(prebidjs, query(search))).toBe(title);
  });
});

describe('repositoryAuthorPageTitle', () => {
  it.each([
    [
      'sample-author-2',
      'scope=period&metric=prAuthors&' + range,
      'PRs by sample-author-2 · Prebid.js',
    ],
    [
      'sample-author-3%5Bbot%5D',
      'scope=period&metric=issueAuthors&' + range,
      'Issues by sample-author-3[bot] · Prebid.js',
    ],
    ['%E0%A4%A', 'scope=period&metric=prAuthors&' + range, 'Prebid.js'],
    ['sample-author-2', 'scope=period&metric=prAuthors', 'Prebid.js'],
    ['sample-author-2', 'scope=current&metric=openIssues', 'Prebid.js'],
  ])('titles %s with ?%s as %s', (account, search, title) => {
    expect(repositoryAuthorPageTitle(prebidjs, account, query(search))).toBe(title);
  });
});

describe('contributionPageTitle', () => {
  it.each([
    ['contributors', 'overview', '', 'Contributors'],
    ['contributors', 'overview', 'scope=1&period=this-year', 'Contributors'],
    ['companies', 'overview', '', 'Companies'],
    ['companies', 'overview', 'view=repositories', 'Companies'],
    ['contributors', 'overview', 'timeline=1&sample=empty', 'Over time · Contributors'],
    [
      'contributors',
      'overview',
      'timeline=1&timeline.detail=prsAuthored',
      reportMetricLabel('prsAuthored') + ' · Over time · Contributors',
    ],
    ['contributors', 'overview', 'timeline=1&timeline.detail=toString', 'Over time · Contributors'],
    [
      'contributors',
      'overview',
      'metric=approvalContributions',
      reportMetricLabel('approvalContributions') + ' · Contributors',
    ],
    ['contributors', 'overview', 'metric=unknown', 'Contributors'],
    ['contributors', alice, '', 'Alice · Contributors'],
    ['contributors', alice, 'view=repositories', 'Alice · Contributors'],
    ['contributors', alice, 'timeline=1', 'Over time · Alice'],
    [
      'contributors',
      alice,
      'metric=approvalContributions',
      reportMetricLabel('approvalContributions') + ' · Alice',
    ],
    ['companies', acme, '', 'Example Acme · Companies'],
    ['companies', acme, 'view=repositories', 'By repository · Example Acme'],
    ['companies', acme, 'timeline=1&view=repositories', 'Over time · Example Acme'],
    ['companies', null, '', 'Unmapped company · Companies'],
  ] as const)('titles %s %o with ?%s as %s', (area, subject, search, title) => {
    expect(contributionPageTitle(area, subject, query(search))).toBe(title);
  });
});
