import { fireEvent, render, screen, within } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { PageHeader } from '@/components/navigation/page-header';
import { formatAsOf } from '@/lib/presentation/format';

const asOf = '2026-10-31T16:00:00.000Z';

describe('PageHeader', () => {
  it('names the page with its one h1 and states the snapshot in the Data source aside', () => {
    render(
      <main>
        <PageHeader
          title="All repositories"
          asOf={asOf}
          meta={<a href="https://github.com/prebid">Prebid on GitHub</a>}
        />
      </main>,
    );
    expect(screen.getAllByRole('heading', { level: 1 })).toHaveLength(1);
    expect(screen.getByRole('heading', { level: 1, name: 'All repositories' })).toBeVisible();
    const source = screen.getByRole('complementary', { name: 'Data source' });
    expect(source).toHaveTextContent('Data as of ' + formatAsOf(asOf));
    expect(source.querySelector('time')).toHaveAttribute('dateTime', asOf);
    expect(screen.getByRole('link', { name: 'Prebid on GitHub' })).toHaveAttribute(
      'href',
      'https://github.com/prebid',
    );
    // A top-level page has no breadcrumb.
    expect(screen.queryByRole('navigation')).not.toBeInTheDocument();
  });

  it('leads the breadcrumb with one back icon and leaves the current view unlinked', () => {
    render(
      <PageHeader
        title="Prebid.js"
        asOf={asOf}
        breadcrumbs={[
          { label: 'All repositories', href: '/repos' },
          { label: 'Prebid.js', href: '/repos/prebidjs' },
        ]}
        current="PR authors"
      />,
    );
    const trail = screen.getByRole('navigation', { name: 'Breadcrumb' });
    const links = within(trail).getAllByRole('link');
    expect(links.map((link) => [link.textContent, link.getAttribute('href')])).toEqual([
      ['All repositories', '/repos'],
      ['Prebid.js', '/repos/prebidjs'],
    ]);
    // The back icon leads the first crumb only; separators sit between crumbs, outside the links.
    expect(links.map((link) => link.querySelectorAll('svg').length)).toEqual([1, 0]);
    expect(within(trail).getAllByRole('listitem')).toHaveLength(3);
    const current = within(trail).getByText('PR authors');
    expect(current).toHaveAttribute('aria-current', 'page');
    expect(current.closest('a')).toBeNull();
    // The subpage names itself in the trail; the repository stays the page's h1.
    expect(screen.getByRole('heading', { level: 1 })).toHaveAccessibleName('Prebid.js');
  });

  it('takes a breadcrumb name, and a crumb whose navigation a handler starts', () => {
    const follow = vi.fn((event: { preventDefault(): void }) => event.preventDefault());
    render(
      <PageHeader
        title="Alice Example"
        asOf={asOf}
        breadcrumbLabel="Contribution breadcrumb"
        breadcrumbs={[
          { label: 'Back to report', href: '/contributors', onClick: follow, pending: true },
        ]}
      />,
    );
    const trail = screen.getByRole('navigation', { name: 'Contribution breadcrumb' });
    const back = within(trail).getByRole('link', { name: 'Back to report' });
    expect(back.querySelector('[data-link-pending]')).toHaveAttribute('data-pending', 'true');
    fireEvent.click(back);
    expect(follow).toHaveBeenCalledTimes(1);
    // Without a current view the trail holds only its links.
    expect(within(trail).getAllByRole('listitem')).toHaveLength(1);
  });

  it('keeps the identity inside the header that holds the h1', () => {
    render(
      <PageHeader
        title="Alice Example"
        asOf={asOf}
        identity={<span role="img" aria-label="Alice Example avatar" />}
        meta={<span>Human</span>}
      />,
    );
    const header = screen.getByRole('heading', { level: 1 }).closest('header')!;
    expect(within(header).getByRole('img', { name: 'Alice Example avatar' })).toBeInTheDocument();
    expect(within(header).getByText('Human')).toBeInTheDocument();
    expect(within(header).getByRole('complementary', { name: 'Data source' })).toBeInTheDocument();
  });

  it('labels prepared sample data in the Data source aside until live data replaces it', () => {
    const view = render(<PageHeader title="All repositories" asOf={asOf} />);
    const source = screen.getByRole('complementary', { name: 'Data source' });
    expect(source).toHaveTextContent(/^Sample data\s*Data as of /);
    view.rerender(<PageHeader title="All repositories" asOf={asOf} sampleData={false} />);
    expect(screen.getByRole('complementary', { name: 'Data source' })).not.toHaveTextContent(
      'Sample data',
    );
  });

  it('shows a dash for a snapshot time it cannot read', () => {
    render(<PageHeader title="All repositories" asOf="not a date" />);
    expect(screen.getByRole('complementary', { name: 'Data source' })).toHaveTextContent(
      'Data as of —',
    );
  });
});
