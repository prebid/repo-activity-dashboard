import { expect, it } from 'vitest';
import { render, screen, within } from '@testing-library/react';
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
function header(focus?: Parameters<typeof selectContributions>[2]) {
  const area = focus?.kind === 'company' ? 'companies' : 'contributors';
  return (
    <ContributionHeader
      page={{
        sample: 'reference',
        area,
        breakdown: 'members',
        returnTo: '/contributors?report.page=2',
        report: selectContributions(contributionSample(), undefined, focus, { area }),
      }}
      links={{
        sample: 'reference',
        currentHref: '/' + area,
        timelineHref: '/' + area + '?timeline=1',
      }}
    />
  );
}
it('puts the area tabs and Report | Over time in one view bar below the page header, without counts', () => {
  render(header());
  const heading = screen.getByRole('heading', { level: 1, name: 'Contributors' });
  const areas = screen.getByRole('navigation', { name: 'Contribution reports' });
  const modes = screen.getByRole('navigation', { name: 'Report view' });
  const bar = areas.closest('[data-view-bar]');
  expect(bar).not.toBeNull();
  expect(modes.closest('[data-view-bar]')).toBe(bar);
  expect(heading.closest('header')).not.toContainElement(areas);
  expect(heading.closest('header')!.compareDocumentPosition(bar!)).toBe(
    Node.DOCUMENT_POSITION_FOLLOWING,
  );
  // The tab names are the areas alone.
  expect(within(areas).getByRole('link', { name: 'Contributors' })).toHaveAttribute(
    'aria-current',
    'page',
  );
  expect(within(areas).getByRole('link', { name: 'Companies' })).toHaveAttribute(
    'href',
    '/companies',
  );
  // An overview has no breadcrumb, eyebrow or subtitle; the Data source aside states the snapshot.
  expect(screen.queryByRole('navigation', { name: 'Contribution breadcrumb' })).toBeNull();
  expect(screen.queryByText('Contribution activity')).toBeNull();
  expect(screen.queryByText(/Understand who authors/)).toBeNull();
  expect(screen.getByRole('complementary', { name: 'Data source' })).toHaveTextContent(
    /^Data as of /,
  );
});
it('leads a focused report’s header with Back to report and keeps its identity and meta line in it', () => {
  const view = render(header({ kind: 'contributor', accountId: 'account-alice' }));
  const contributor = screen.getByRole('heading', { level: 1, name: 'Alice' }).closest('header')!;
  const trail = within(contributor).getByRole('navigation', { name: 'Contribution breadcrumb' });
  expect(within(trail).getByRole('link', { name: 'Back to report' })).toHaveAttribute(
    'href',
    '/contributors?report.page=2',
  );
  expect(within(contributor).getByRole('link', { name: /@sample-alice/ })).toBeVisible();
  expect(within(contributor).getByText('Human')).toBeVisible();
  expect(within(contributor).getByRole('link', { name: 'Example Acme' })).toBeVisible();
  expect(screen.queryByText('Contributor report')).toBeNull();
  // A focused report has no area tabs; its view modes stay in the view bar.
  expect(screen.queryByRole('navigation', { name: 'Contribution reports' })).toBeNull();
  expect(
    screen.getByRole('navigation', { name: 'Report view' }).closest('[data-view-bar]'),
  ).not.toBeNull();
  view.rerender(header({ kind: 'company', companyId: 'company-acme' }));
  const company = screen
    .getByRole('heading', { level: 1, name: 'Example Acme' })
    .closest('header')!;
  expect(within(company).getByRole('link', { name: 'Back to report' })).toBeVisible();
  expect(within(company).getByText('3 included accounts · Current company mapping')).toBeVisible();
  expect(screen.queryByText('Company report')).toBeNull();
});
