import Link from 'next/link';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { DisabledTab, TabCount, ViewTabs } from '@/components/navigation/view-tabs';

describe('ViewTabs', () => {
  it.each([undefined, 'underline', 'segmented'] as const)(
    'names its navigation and marks the current tab (%s)',
    (variant) => {
      render(
        <ViewTabs label="Repository overview views" variant={variant}>
          <Link href="/repos" aria-current="page">
            Summary
          </Link>
          <Link href="/repos?timeline=1">Timeline</Link>
        </ViewTabs>,
      );
      const tabs = screen.getByRole('navigation', { name: 'Repository overview views' });
      expect(within(tabs).getByRole('link', { name: 'Summary' })).toHaveAttribute(
        'aria-current',
        'page',
      );
      expect(within(tabs).getByRole('link', { name: 'Timeline' })).not.toHaveAttribute(
        'aria-current',
      );
    },
  );

  it('keeps an unavailable tab focusable and states why it is unavailable', async () => {
    render(
      <ViewTabs label="Report view">
        <Link href="/contributors" aria-current="page">
          Report
        </Link>
        <DisabledTab reason="This selection is too large for an Over time link.">
          Over time
        </DisabledTab>
      </ViewTabs>,
    );
    const tab = screen.getByRole('link', { name: 'Over time' });
    expect(tab).toHaveAttribute('aria-disabled', 'true');
    expect(tab).toHaveAccessibleDescription('This selection is too large for an Over time link.');
    await userEvent.tab();
    await userEvent.tab();
    expect(tab).toHaveFocus();
  });

  it('reads a count and its unit as part of the tab name', () => {
    render(
      <ViewTabs label="Repository lists">
        <Link href="/repos/prebidjs" aria-current="page">
          Pull requests
          <TabCount unit="open" title="Current open count">
            137
          </TabCount>
        </Link>
        <Link href="/repos/prebidjs?kind=issues">
          Companies
          <TabCount>12</TabCount>
        </Link>
      </ViewTabs>,
    );
    const tabs = screen.getByRole('navigation', { name: 'Repository lists' });
    expect(within(tabs).getByRole('link', { name: 'Pull requests 137 open' })).toBeVisible();
    expect(within(tabs).getByTitle('Current open count')).toHaveTextContent('137 open');
    expect(within(tabs).getByRole('link', { name: 'Companies 12' })).toBeVisible();
  });
});
