import Link from 'next/link';
import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { renderToString } from 'react-dom/server';
import { hydrateRoot, type Root } from 'react-dom/client';
import { beforeEach, describe, expect, it, vi, type MockInstance } from 'vitest';
import { ViewBar } from '@/components/navigation/view-bar';
import { ViewTabs } from '@/components/navigation/view-tabs';
import type { PageSection } from '@/components/navigation/section-nav';
import { ChartPanel } from '@/components/charts/chart-panel';
import { LocalDataTable } from '@/components/tables/local-data-table';

const sections: PageSection[] = [
  { id: 'current-backlog', label: 'Current backlog' },
  { id: 'period-activity', label: 'Period activity' },
];

function Page({ links = sections }: { links?: PageSection[] }) {
  return (
    <main>
      <ViewBar sections={links}>
        <ViewTabs label="Repository lists">
          <Link href="/repos/prebidjs" aria-current="page">
            Pull requests
          </Link>
        </ViewTabs>
      </ViewBar>
      {sections.map((section) => (
        <section key={section.id} id={section.id} aria-label={section.label}>
          <h2 tabIndex={-1}>{section.label}</h2>
        </section>
      ))}
    </main>
  );
}

// jsdom lays nothing out: these stand in for the browser's scrolling and box geometry.
let scrolled: [number, number][] = [];
let tops: Record<string, number> = {};
let boxes: MockInstance<Element['getBoundingClientRect']>;
beforeEach(() => {
  scrolled = [];
  tops = {};
  vi.stubGlobal('scrollTo', (x: number, y: number) => scrolled.push([x, y]));
  boxes = vi.spyOn(Element.prototype, 'getBoundingClientRect').mockImplementation(function (
    this: Element,
  ) {
    const top = tops[this.id] ?? 0;
    return { top, bottom: top + 100, left: 0, right: 100, width: 100, height: 100 } as DOMRect;
  });
});
/** The root scroll padding prebid.css and globals.css set: the masthead, the bar and 12px. */
function landingLine(top: number) {
  const computed = window.getComputedStyle.bind(window);
  vi.spyOn(window, 'getComputedStyle').mockImplementation((element, pseudo) => {
    const style = computed(element, pseudo);
    if (element === document.documentElement)
      Object.defineProperty(style, 'scrollPaddingTop', { value: top + 'px' });
    return style;
  });
}

const chips = () => screen.getByRole('navigation', { name: 'On this page' });
const chip = (name: string) => within(chips()).getByRole('link', { name });
/** Moves the page and lets the scroll listener's next frame run. */
async function scrollPage(y: number, positions: Record<string, number>) {
  vi.stubGlobal('scrollY', y);
  tops = positions;
  fireEvent.scroll(window);
  await act(() => new Promise<void>((resolve) => requestAnimationFrame(() => resolve())));
}

describe('SectionNav', () => {
  it('jumps to a section, focuses its heading and replaces the fragment without a Back entry', async () => {
    window.history.replaceState({ kept: true }, '', '/repos?metric=prAuthors');
    const entries = window.history.length;
    landingLine(120);
    vi.stubGlobal('scrollY', 300);
    render(<Page />);
    tops = { 'current-backlog': 100, 'period-activity': 640 };
    await userEvent.click(chip('Period activity'));
    // The section's top comes to the landing line: 300 + 640 - 120.
    expect(scrolled).toEqual([[0, 820]]);
    expect(screen.getByRole('heading', { name: 'Period activity' })).toHaveFocus();
    expect(window.location.pathname + window.location.search + window.location.hash).toBe(
      '/repos?metric=prAuthors#period-activity',
    );
    expect(window.history.length).toBe(entries);
    expect(window.history.state).toEqual({ kept: true });
    expect(chip('Period activity')).toHaveAttribute('aria-current', 'location');
    expect(chip('Current backlog')).not.toHaveAttribute('aria-current');
  });

  it('jumps on Enter from a focused chip', async () => {
    render(<Page />);
    chip('Current backlog').focus();
    await userEvent.keyboard('{Enter}');
    expect(screen.getByRole('heading', { name: 'Current backlog' })).toHaveFocus();
    expect(window.location.hash).toBe('#current-backlog');
  });

  it('leaves a modified click, and a link to a missing section, to the browser', () => {
    // Records whether the chip took the click, then stops jsdom's own fragment navigation.
    const taken: boolean[] = [];
    const record = (event: Event) => {
      taken.push(event.defaultPrevented);
      event.preventDefault();
    };
    document.addEventListener('click', record);
    tops = { 'period-activity': 640 };
    try {
      render(<Page links={[...sections, { id: 'missing', label: 'Missing' }]} />);
      fireEvent.click(chip('Period activity'), { ctrlKey: true });
      fireEvent.click(chip('Period activity'), { button: 1 });
      fireEvent.click(chip('Missing'));
      fireEvent.click(chip('Period activity'));
    } finally {
      document.removeEventListener('click', record);
    }
    expect(taken).toEqual([false, false, false, true]);
    expect(scrolled).toEqual([[0, 640]]);
  });

  it('marks the section whose top has reached the landing line as the reader scrolls', async () => {
    render(<Page />);
    await scrollPage(0, { 'current-backlog': 300, 'period-activity': 900 });
    expect(chip('Current backlog')).toHaveAttribute('aria-current', 'location');
    await scrollPage(1200, { 'current-backlog': -900, 'period-activity': 0 });
    expect(chip('Period activity')).toHaveAttribute('aria-current', 'location');
    expect(chip('Current backlog')).not.toHaveAttribute('aria-current');
    await scrollPage(400, { 'current-backlog': -100, 'period-activity': 500 });
    expect(chip('Current backlog')).toHaveAttribute('aria-current', 'location');
    // Scrolling writes no history and leaves the fragment alone.
    expect(window.location.hash).toBe('');
  });

  it('keeps a jumped-to section current until the page moves from where the jump left it', async () => {
    // At the page end the last section cannot reach the landing line.
    await scrollPage(2000, { 'current-backlog': -900, 'period-activity': 200 });
    render(<Page />);
    await scrollPage(2000, tops);
    expect(chip('Current backlog')).toHaveAttribute('aria-current', 'location');
    await userEvent.click(chip('Period activity'));
    await scrollPage(2000, tops);
    expect(chip('Period activity')).toHaveAttribute('aria-current', 'location');
    await scrollPage(1500, { 'current-backlog': -400, 'period-activity': 700 });
    expect(chip('Current backlog')).toHaveAttribute('aria-current', 'location');
  });

  it('chooses a section from the Sections menu and leaves focus on its heading', async () => {
    const user = userEvent.setup();
    const entries = window.history.length;
    render(<Page />);
    await user.click(within(chips()).getByRole('button', { name: 'Sections' }));
    await user.click(screen.getByRole('menuitem', { name: 'Period activity' }));
    await waitFor(() =>
      expect(screen.getByRole('heading', { name: 'Period activity' })).toHaveFocus(),
    );
    expect(screen.queryByRole('menu')).not.toBeInTheDocument();
    expect(window.location.hash).toBe('#period-activity');
    expect(window.history.length).toBe(entries);
  });

  it('returns focus to the Sections button when the menu closes without a choice', async () => {
    const user = userEvent.setup();
    tops = { 'current-backlog': 300, 'period-activity': 900 };
    render(<Page />);
    const trigger = within(chips()).getByRole('button', { name: 'Sections' });
    await user.click(trigger);
    expect(screen.getByRole('menuitem', { name: 'Current backlog' })).toHaveAttribute(
      'aria-current',
      'location',
    );
    await user.keyboard('{Escape}');
    await waitFor(() => expect(trigger).toHaveFocus());
    expect(scrolled).toEqual([]);
    expect(window.location.hash).toBe('');
  });

  it('server-renders the chips, the first one current, and enables the menu once hydrated', async () => {
    const container = document.createElement('div');
    container.innerHTML = renderToString(<Page />);
    document.body.append(container);
    const serverTrigger = within(container).getByRole('button', { name: 'Sections' });
    expect(serverTrigger).toBeDisabled();
    expect(within(container).getByRole('link', { name: 'Current backlog' })).toHaveAttribute(
      'aria-current',
      'location',
    );
    const recover = vi.fn();
    const errors = vi.spyOn(console, 'error').mockImplementation(() => {});
    let root: Root | undefined;
    try {
      act(() => {
        root = hydrateRoot(container, <Page />, { onRecoverableError: recover });
      });
      await waitFor(() => expect(serverTrigger).toBeEnabled());
      expect(within(container).getByRole('button', { name: 'Sections' })).toBe(serverTrigger);
      expect(recover).not.toHaveBeenCalled();
      expect(errors).not.toHaveBeenCalled();
    } finally {
      act(() => root?.unmount());
      container.remove();
      errors.mockRestore();
    }
  });
});

describe('ViewBar', () => {
  it('shows section chips only for two or more sections', () => {
    render(<Page links={sections.slice(0, 1)} />);
    expect(screen.getByRole('navigation', { name: 'Repository lists' })).toBeInTheDocument();
    expect(screen.queryByRole('navigation', { name: 'On this page' })).not.toBeInTheDocument();
  });

  it('scrolls a sideways-scrolling tab row, once, to its current tab', () => {
    vi.spyOn(Element.prototype, 'scrollWidth', 'get').mockReturnValue(600);
    vi.spyOn(Element.prototype, 'clientWidth', 'get').mockReturnValue(200);
    const left = vi.spyOn(Element.prototype, 'scrollLeft', 'set');
    tops = {};
    boxes.mockImplementation(function (this: Element) {
      const box = this.getAttribute('aria-current') === 'page' ? [400, 100] : [0, 200];
      return { left: box[0], right: box[0] + box[1], width: box[1] } as DOMRect;
    });
    const tabs = (current: 'issues' | 'timeline') => (
      <ViewBar>
        <ViewTabs label="Repository lists">
          <Link href="/repos/prebidjs">Pull requests</Link>
          <Link
            href="/repos/prebidjs?kind=issues"
            aria-current={current === 'issues' ? 'page' : undefined}
          >
            Issues
          </Link>
          <Link
            href="/repos/prebidjs?timeline=1"
            aria-current={current === 'timeline' ? 'page' : undefined}
          >
            Timeline
          </Link>
        </ViewTabs>
      </ViewBar>
    );
    const view = render(tabs('issues'));
    // The tab's centre comes to the row's centre: 400 - 0 - (200 - 100) / 2.
    expect(left).toHaveBeenCalledTimes(1);
    expect(left).toHaveBeenLastCalledWith(350);
    view.rerender(tabs('issues'));
    expect(left).toHaveBeenCalledTimes(1);
    view.rerender(tabs('timeline'));
    expect(left).toHaveBeenCalledTimes(2);
  });

  it('leaves a tab row alone when it fits or its current tab is in view', () => {
    const left = vi.spyOn(Element.prototype, 'scrollLeft', 'set');
    render(<Page />);
    vi.spyOn(Element.prototype, 'scrollWidth', 'get').mockReturnValue(600);
    vi.spyOn(Element.prototype, 'clientWidth', 'get').mockReturnValue(200);
    render(<Page />);
    expect(left).not.toHaveBeenCalled();
  });
});

describe('Section anchors', () => {
  it('makes anchored table and chart panels sections whose titles take focus after a jump', async () => {
    const [table, chart] = [
      { id: 'current-backlog', label: 'Current backlog' },
      { id: 'at-a-glance', label: 'At a glance' },
    ];
    render(
      <main>
        <ViewBar sections={[table, chart]}>
          <ViewTabs label="Repository overview views">
            <Link href="/repos" aria-current="page">
              Summary
            </Link>
          </ViewTabs>
        </ViewBar>
        <LocalDataTable
          title="Current backlog"
          anchor="current-backlog"
          search="none"
          rows={[{ id: 'prebidjs', name: 'Prebid.js' }]}
          columns={[{ id: 'name', label: 'Repository', value: (row) => row.name }]}
          showColumnMenu={false}
        />
        <ChartPanel
          label="Repository charts"
          title="At a glance"
          anchor="at-a-glance"
          description="All matching PRs."
          content="bars"
          showLabel="Show charts"
          hideLabel="Hide charts"
          expanded={false}
          onExpandedChange={() => {}}
        >
          <p>Charts</p>
        </ChartPanel>
      </main>,
    );
    expect(screen.getByRole('region', { name: 'Current backlog' })).toHaveAttribute(
      'id',
      'current-backlog',
    );
    expect(screen.getByRole('region', { name: 'Repository charts' })).toHaveAttribute(
      'id',
      'at-a-glance',
    );
    await userEvent.click(chip('At a glance'));
    expect(screen.getByRole('heading', { level: 2, name: 'At a glance' })).toHaveFocus();
    await userEvent.click(chip('Current backlog'));
    expect(screen.getByRole('heading', { level: 2, name: 'Current backlog' })).toHaveFocus();
  });

  it('leaves unanchored panels out: no id and a title that does not take focus', () => {
    render(
      <>
        <LocalDataTable
          title="Current backlog"
          search="none"
          rows={[{ id: 'prebidjs', name: 'Prebid.js' }]}
          columns={[{ id: 'name', label: 'Repository', value: (row) => row.name }]}
          showColumnMenu={false}
        />
        <ChartPanel
          label="Repository charts"
          title="At a glance"
          description="All matching PRs."
          content="bars"
          showLabel="Show charts"
          hideLabel="Hide charts"
          expanded={false}
          onExpandedChange={() => {}}
        >
          <p>Charts</p>
        </ChartPanel>
      </>,
    );
    for (const name of ['Current backlog', 'Repository charts']) {
      expect(screen.getByRole('region', { name })).not.toHaveAttribute('id');
    }
    for (const name of ['Current backlog', 'At a glance']) {
      const heading = screen.getByRole('heading', { level: 2, name });
      heading.focus();
      expect(heading).not.toHaveFocus();
    }
  });
});
