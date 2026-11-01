import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { renderToString } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import {
  noReportControls,
  ReportToolbar,
  reportToolbarStatus,
  type ReportToolbarGroup,
  type ReportToolbarProps,
  type ReportToolbarStatus,
} from '@/components/reporting/report-toolbar';

const filters = (onReset = () => {}): ReportToolbarGroup => ({
  label: 'Filters',
  controls: <button type="button">Choose repositories</button>,
  reset: { label: 'Reset filters', onReset },
});
const display: ReportToolbarGroup = {
  label: 'Display',
  controls: (
    <label>
      Grouping
      <select defaultValue="month">
        <option value="month">Month</option>
      </select>
    </label>
  ),
};
function toolbar(props: Partial<ReportToolbarProps>) {
  return render(
    <ReportToolbar
      label="Contribution report scope"
      disabled={false}
      groups={[filters()]}
      status={{ kind: 'saved' }}
      {...props}
    />,
  );
}

describe('ReportToolbar', () => {
  it('frames one group with a hidden legend and a ghost reset at the row end', async () => {
    const reset = vi.fn();
    toolbar({ groups: [filters(reset)] });
    const region = screen.getByRole('region', { name: 'Contribution report scope' });
    const group = within(region).getByRole('group', { name: 'Filters' });
    expect(group.tagName).toBe('FIELDSET');
    expect(group.querySelector('legend')).toHaveClass('sr-only');
    const button = within(group).getByRole('button', { name: 'Reset filters' });
    expect(button).toHaveAttribute('type', 'button');
    expect(button.querySelector('svg')).toHaveClass('lucide-rotate-ccw');
    expect(button.querySelector('svg')).toHaveAttribute('width', '14');
    await userEvent.click(button);
    expect(reset).toHaveBeenCalledTimes(1);
  });

  it('labels two groups visibly and gives each its own reset', () => {
    toolbar({
      groups: [filters(), { ...display, reset: { label: 'Reset view', onReset: () => {} } }],
    });
    const groups = screen.getAllByRole('group');
    expect(groups).toEqual([
      screen.getByRole('group', { name: 'Filters' }),
      screen.getByRole('group', { name: 'Display' }),
    ]);
    for (const group of groups) expect(group.querySelector('legend')).not.toHaveClass('sr-only');
    expect(within(groups[0]).getByRole('button', { name: 'Reset filters' })).toBeInTheDocument();
    expect(within(groups[1]).getByRole('button', { name: 'Reset view' })).toBeInTheDocument();
    expect(within(groups[1]).getByRole('combobox', { name: 'Grouping' })).toBeInTheDocument();
  });

  it('renders a group without a reset', () => {
    toolbar({ groups: [display] });
    expect(screen.getByRole('group', { name: 'Display' })).toBeInTheDocument();
    expect(screen.queryByRole('button')).not.toBeInTheDocument();
  });

  it('disables every control, reset included, while disabled', () => {
    toolbar({ disabled: true, groups: [filters(), display] });
    for (const group of screen.getAllByRole('group')) expect(group).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Choose repositories' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Reset filters' })).toBeDisabled();
    expect(screen.getByRole('combobox', { name: 'Grouping' })).toBeDisabled();
  });

  it.each([
    [{ kind: 'saved' }, 'Preferences saved for your account on this browser.'],
    [{ kind: 'not-saved' }, 'Browser storage is unavailable. Changes still work in this URL.'],
    [{ kind: 'updating', subject: 'report' }, 'Updating report…'],
    [{ kind: 'updating', subject: 'timeline' }, 'Updating timeline…'],
  ] as [ReportToolbarStatus, string][])('says %j in its only status line', (status, text) => {
    toolbar({ status });
    expect(screen.getByRole('status').textContent).toBe(text);
  });

  it('keeps an empty live region when the sentence is hidden', () => {
    toolbar({ status: { kind: 'hidden' } });
    expect(screen.getByRole('status')).toBeEmptyDOMElement();
  });

  it('joins an info notice to the status line', () => {
    toolbar({ notice: { tone: 'info', text: 'Saved filters could not be restored.' } });
    const status = screen.getByRole('status');
    expect(status).toHaveTextContent(
      /^Saved filters could not be restored\.Preferences saved for your account on this browser\.$/,
    );
    expect(status.querySelector('[data-tone="info"]')).not.toBeNull();
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });

  it('announces an error notice as an alert outside the status line', () => {
    toolbar({
      status: { kind: 'hidden' },
      notice: { tone: 'error', text: 'Choose a shorter range.' },
      footnote: 'Changing Records clears record filters.',
    });
    const alert = screen.getByRole('alert');
    expect(alert).toHaveTextContent(/^Choose a shorter range\.$/);
    expect(alert).toHaveAttribute('data-tone', 'error');
    expect(screen.getByRole('status')).toBeEmptyDOMElement();
    expect(screen.getAllByRole('status')).toHaveLength(1);
    expect(screen.getByText('Changing Records clears record filters.')).toBeInTheDocument();
  });

  it('separates summary facts with dots after an optional lead', () => {
    const { container, rerender } = toolbar({
      summary: { lead: 'Jan 1 – Oct 31, 2026 · UTC', facts: ['10 intervals', '18 repositories'] },
    });
    const summary = () => container.querySelector('section > p:last-child')!;
    expect(summary().textContent).toBe(
      'Jan 1 – Oct 31, 2026 · UTC · 10 intervals · 18 repositories',
    );
    const facts = { facts: ['10 intervals', '18 repositories'] };
    rerender(
      <ReportToolbar
        label="Timeline scope"
        disabled={false}
        groups={[display]}
        status={{ kind: 'hidden' }}
        summary={facts}
      />,
    );
    expect(summary().textContent).toBe('10 intervals · 18 repositories');
    expect(summary().querySelectorAll('[aria-hidden="true"]')).toHaveLength(1);
    rerender(
      <ReportToolbar
        label="Timeline scope"
        disabled={false}
        groups={[display]}
        status={{ kind: 'hidden' }}
        summary={{ facts: [] }}
      />,
    );
    expect(container.querySelector('section > p')).toBeNull();
    rerender(
      <ReportToolbar
        label="Timeline scope"
        disabled={false}
        groups={[display]}
        status={{ kind: 'hidden' }}
        summary={{ lead: 'Oct 2026 · UTC', facts: [] }}
      />,
    );
    expect(summary().textContent).toBe('Oct 2026 · UTC');
    expect(summary().querySelectorAll('[aria-hidden="true"]')).toHaveLength(0);
  });

  it('disables its groups in server markup, before client handlers attach', () => {
    const container = document.createElement('div');
    container.innerHTML = renderToString(
      <ReportToolbar
        label="Timeline scope"
        disabled={false}
        groups={[filters()]}
        status={{ kind: 'saved' }}
      />,
    );
    expect(container.querySelector('fieldset')).toBeDisabled();
  });

  it('keeps only the summary when a view renders without its controls', () => {
    const { container } = render(
      <ReportToolbar
        label="Timeline scope"
        {...noReportControls}
        summary={{ lead: 'Oct 2026 · UTC', facts: ['10 intervals'] }}
      />,
    );
    const region = screen.getByRole('region', { name: 'Timeline scope' });
    expect(within(region).queryByRole('group')).toBeNull();
    expect(within(region).queryByRole('status')).toBeNull();
    expect(region.children).toHaveLength(1);
    expect(container.querySelector('section > p')!.textContent).toBe(
      'Oct 2026 · UTC · 10 intervals',
    );
  });

  it.each([
    [true, true, { kind: 'updating', subject: 'timeline' }],
    [true, false, { kind: 'updating', subject: 'timeline' }],
    [false, true, { kind: 'saved' }],
    [false, false, { kind: 'not-saved' }],
  ] as const)('maps pending %s and storage %s to its status line', (pending, storage, status) => {
    expect(reportToolbarStatus(pending, storage, 'timeline')).toEqual(status);
  });
});
