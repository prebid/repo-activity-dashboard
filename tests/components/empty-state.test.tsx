import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { EmptyState, emptyStateKinds } from '@/components/feedback/empty-state';

const glyphs = {
  empty: 'inbox',
  'no-match': 'search-x',
  missing: 'circle-dashed',
  error: 'circle-alert',
  loading: 'loader-circle',
} as const;

describe('EmptyState', () => {
  it.each(emptyStateKinds)('shows the %s kind as a framed status by default', (kind) => {
    render(<EmptyState kind={kind} title="Nothing here" />);
    const state = screen.getByRole('status');
    expect(state.tagName).toBe('SECTION');
    expect(state).toHaveAttribute('data-kind', kind);
    expect(state).toHaveAttribute('data-variant', 'page');
    expect(screen.getByRole('heading', { level: 2, name: 'Nothing here' })).toBeInTheDocument();
    const icons = state.querySelectorAll('svg');
    expect(icons).toHaveLength(1);
    expect(icons[0]).toHaveClass('lucide-' + glyphs[kind]);
    expect(icons[0]).toHaveAttribute('width', '16');
    expect(screen.queryByRole('button')).not.toBeInTheDocument();
    expect(state).toHaveTextContent(/^Nothing here$/);
  });

  it('becomes an alert with a retry only when one is offered', async () => {
    const retry = vi.fn();
    render(
      <EmptyState kind="error" title="This page could not load" onRetry={retry}>
        Please try again.
      </EmptyState>,
    );
    const state = screen.getByRole('alert');
    expect(screen.queryByRole('status')).not.toBeInTheDocument();
    expect(state).toHaveTextContent('Please try again.');
    const button = screen.getByRole('button', { name: 'Try again' });
    expect(button).toHaveAttribute('type', 'button');
    expect(button.querySelector('svg')).toHaveClass('lucide-refresh-cw');
    await userEvent.click(button);
    expect(retry).toHaveBeenCalledTimes(1);
  });

  it('keeps an error without a retry as a status', () => {
    render(<EmptyState kind="error" title="Could not load records" />);
    expect(screen.getByRole('status')).toHaveAttribute('data-kind', 'error');
  });

  it('renders an existing next step beside the retry', () => {
    render(
      <EmptyState
        kind="no-match"
        title="No matching PRs"
        variant="embedded"
        action={<button type="button">Clear filters</button>}
        onRetry={() => {}}
      >
        <p>No PR matches the search.</p>
      </EmptyState>,
    );
    const state = screen.getByRole('alert');
    expect(state).toHaveAttribute('data-variant', 'embedded');
    expect(screen.getAllByRole('button').map((button) => button.textContent)).toEqual([
      'Clear filters',
      'Try again',
    ]);
    expect(screen.getByText('No PR matches the search.')).toBeInTheDocument();
  });

  it('renders an action without a retry as a status', () => {
    render(
      <EmptyState
        kind="missing"
        title="Sample records unavailable"
        action={<a href="#report">Return to report</a>}
      />,
    );
    expect(screen.getByRole('status')).toContainElement(
      screen.getByRole('link', { name: 'Return to report' }),
    );
  });
});
