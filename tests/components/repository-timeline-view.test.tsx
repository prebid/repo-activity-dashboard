import { expect, it, vi } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { RepositoryTimelineView } from '@/features/repositories/repository-timeline-view';
import { selectRepositoryTimeline } from '@/lib/presentation/repository-timeline';
import { castTimelineSample as repositoryTimelineSample } from '../support/cast-timeline';

const report = selectRepositoryTimeline(repositoryTimelineSample(), {
  grouping: 'month',
  range: { start: '2026-01-01T00:00:00.000Z', end: '2026-10-24T12:00:00.000Z', endInclusive: true },
});
const navigation = {
  githubUrl: 'https://github.example/prebid/Prebid.js',
  openPrs: { status: 'complete' as const, value: 3 },
  openIssues: { status: 'complete' as const, value: 4 },
  sample: true,
};

it.each([
  ['a list', '/repos/prebidjs?view=issues&back=~period:last-month'],
  ['a matrix', '/repos?timeline&back=~period:last-month'],
])(
  'keeps the All repositories origin of %s parent in the breadcrumb and record tabs',
  (_, parent) => {
    render(
      <RepositoryTimelineView
        report={report}
        navigation={navigation}
        href="/repos/prebidjs?timeline=1"
        parent={parent}
      />,
    );
    expect(screen.getByRole('link', { name: 'All repositories' })).toHaveAttribute(
      'href',
      '/repos?period=last-month',
    );
    expect(screen.getByRole('link', { name: /^Pull requests/ })).toHaveAttribute(
      'href',
      '/repos/prebidjs?back=~period:last-month',
    );
    expect(screen.getByRole('link', { name: /^Issues/ })).toHaveAttribute(
      'href',
      '/repos/prebidjs?view=issues&back=~period:last-month',
    );
  },
);
it('marks the Summary unavailable when the parent page names one that cannot be restored', () => {
  render(
    <RepositoryTimelineView
      report={report}
      navigation={navigation}
      href="/repos/prebidjs?timeline=1"
      parent="/repos/prebidjs?back=!"
    />,
  );
  expect(screen.queryByRole('link', { name: 'All repositories' })).toBeNull();
  expect(screen.getByText('All repositories').closest('[aria-disabled]')).toHaveAttribute(
    'aria-disabled',
    'true',
  );
  expect(screen.getByRole('link', { name: /^Pull requests/ })).toHaveAttribute(
    'href',
    '/repos/prebidjs?back=!',
  );
});
it('opens All repositories as the masthead does when the Timeline names no parent', () => {
  render(
    <RepositoryTimelineView
      report={report}
      navigation={navigation}
      href="/repos/prebidjs?timeline"
    />,
  );
  // Without a signed-in binding the entry link stays bare.
  expect(screen.getByRole('link', { name: 'All repositories' })).toHaveAttribute('href', '/repos');
  expect(screen.queryByRole('link', { name: 'Previous repository view' })).toBeNull();
});
it('marks a parent that cannot be restored unavailable, with All repositories', () => {
  render(
    <RepositoryTimelineView
      report={report}
      navigation={navigation}
      href="/repos/prebidjs?timeline&back=!"
      parent={null}
    />,
  );
  expect(screen.queryByRole('link', { name: 'Previous repository view' })).toBeNull();
  expect(screen.getByText('Previous repository view').closest('[aria-disabled]')).toHaveAttribute(
    'aria-disabled',
    'true',
  );
  expect(screen.queryByRole('link', { name: 'All repositories' })).toBeNull();
});
it('keeps Timeline the current record tab and links its chart and table from the view bar', async () => {
  vi.stubGlobal('scrollTo', () => {});
  const user = userEvent.setup();
  render(
    <RepositoryTimelineView
      report={report}
      navigation={navigation}
      href="/repos/prebidjs?timeline"
    />,
  );
  expect(screen.getByRole('heading', { level: 1 })).toHaveAccessibleName('Prebid.js');
  const tabs = screen.getByRole('navigation', { name: 'Repository lists' });
  expect(within(tabs).getByRole('link', { name: 'Timeline' })).toHaveAttribute(
    'aria-current',
    'page',
  );
  const sections = screen.getByRole('navigation', { name: 'On this page' });
  expect(within(sections).getByRole('link', { name: 'Trend' })).toHaveAttribute('href', '#trend');
  await user.click(within(sections).getByRole('link', { name: 'Activity over time' }));
  expect(screen.getByRole('heading', { level: 2, name: 'Activity over time' })).toHaveFocus();
  expect(window.location.hash).toBe('#over-time');
});
