import { expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import {
  ContributionHeader,
  ContributionReportViewTabs,
} from '@/features/contributions/contribution-header';
import { contributionSample } from '@/mocks/contributions';
import { selectContributions } from '@/lib/presentation/contributions';

it('keeps an unavailable Over time tab focusable and explains why it is unavailable', () => {
  render(
    <ContributionReportViewTabs active="report" reportHref="/contributors" timelineHref={null} />,
  );
  const tabs = screen.getByRole('navigation', { name: 'Report view' });
  expect(screen.getByRole('link', { name: 'Report' })).toHaveAttribute('aria-current', 'page');
  const unavailable = screen.getByRole('link', { name: 'Over time' });
  expect(tabs).toContainElement(unavailable);
  expect(unavailable).toHaveAttribute('aria-disabled', 'true');
  expect(unavailable).toHaveAttribute('tabindex', '0');
  expect(unavailable).not.toHaveAttribute('href');
  expect(unavailable).toHaveAccessibleDescription(
    'This selection is too large for an Over time link. Narrow the filters or search and try again.',
  );
});
it('links the Over time tab when its URL fits', () => {
  render(
    <ContributionReportViewTabs
      active="timeline"
      reportHref="/contributors"
      timelineHref="/contributors?timeline=1"
    />,
  );
  const timeline = screen.getByRole('link', { name: 'Over time' });
  expect(timeline).toHaveAttribute('href', '/contributors?timeline=1');
  expect(timeline).toHaveAttribute('aria-current', 'page');
  expect(timeline).not.toHaveAttribute('aria-disabled');
});
const reportTabs = [
  ['contributors', /^Contributors/],
  ['companies', /^Companies/],
  ['report', /^Report$/],
  ['timeline', /^Over time$/],
] as const;
it.each(['contributors', 'companies', 'timeline', null])(
  'marks only the %s tab pending while its handler navigation is pending',
  (target) => {
    render(
      <ContributionHeader
        page={{
          sample: 'reference',
          area: 'contributors',
          breakdown: 'members',
          returnTo: '/contributors',
          report: selectContributions(contributionSample(), undefined, undefined, {
            area: 'contributors',
          }),
        }}
        links={{
          sample: 'reference',
          currentHref: '/contributors',
          timelineHref: '/contributors?timeline=1',
          pendingTarget: target,
        }}
      />,
    );
    for (const [key, name] of reportTabs)
      expect(screen.getByRole('link', { name }).lastElementChild).toHaveAttribute(
        'data-pending',
        String(key === target),
      );
  },
);
