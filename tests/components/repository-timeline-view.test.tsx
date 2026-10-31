import { expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { RepositoryTimelineView } from '@/features/repositories/repository-timeline-view';
import { selectRepositoryTimeline } from '@/lib/presentation/repository-timeline';
import { repositoryTimelineSample } from '@/mocks/repository-timeline';

const report = selectRepositoryTimeline(repositoryTimelineSample(), {
  grouping: 'month',
  range: { start: '2026-01-01T00:00:00.000Z', end: '2026-10-24T12:00:00.000Z', endInclusive: true },
});
const navigation = {
  githubUrl: 'https://github.example/prebid/Prebid.js',
  openPrs: { status: 'complete' as const, value: 3 },
  openIssues: { status: 'complete' as const, value: 4 },
};

it('keeps the All repositories origin in the breadcrumb and both record tabs', () => {
  render(
    <RepositoryTimelineView
      report={report}
      navigation={navigation}
      href="/repos/prebidjs?timeline=1"
      parent="/repos/prebidjs?returnTo=%2Frepos%3Fperiod%3Dlast-month"
    />,
  );
  expect(screen.getByRole('link', { name: '← All repositories' })).toHaveAttribute(
    'href',
    '/repos?period=last-month',
  );
  for (const name of [/^Pull requests/, /^Issues/])
    expect(
      new URL(
        screen.getByRole('link', { name }).getAttribute('href')!,
        'https://example.test',
      ).searchParams.get('returnTo'),
    ).toBe('/repos?period=last-month');
});
it('returns to All repositories when the parent is not a repository page with an origin', () => {
  render(
    <RepositoryTimelineView
      report={report}
      navigation={navigation}
      href="/repos/prebidjs?timeline=1"
      parent="/repos/prebidjs?returnTo=https%3A%2F%2Fexample.test%2Frepos"
    />,
  );
  expect(screen.getByRole('link', { name: '← All repositories' })).toHaveAttribute(
    'href',
    '/repos',
  );
});
