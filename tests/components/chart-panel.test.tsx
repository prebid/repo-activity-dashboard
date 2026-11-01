import { useState } from 'react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import {
  ChartCell,
  ChartCells,
  ChartPanel,
  type ChartPanelProps,
} from '@/components/charts/chart-panel';

function Panel(props: Partial<ChartPanelProps>) {
  const [expanded, setExpanded] = useState(false);
  return (
    <ChartPanel
      label="Repository charts"
      title="At a glance"
      description="All matching PRs, across every page."
      content="bars"
      showLabel="Show charts"
      hideLabel="Hide charts"
      expanded={expanded}
      onExpandedChange={setExpanded}
      {...props}
    >
      <p>Chart body</p>
    </ChartPanel>
  );
}

describe('ChartPanel', () => {
  it('starts collapsed with nothing drawn in its body', () => {
    render(<Panel />);
    const region = screen.getByRole('region', { name: 'Repository charts' });
    expect(region).toHaveAttribute('data-expanded', 'false');
    expect(screen.getByRole('heading', { level: 2, name: 'At a glance' })).toBeInTheDocument();
    expect(screen.getByText('All matching PRs, across every page.')).toBeInTheDocument();
    const trigger = screen.getByRole('button', { name: 'Show charts' });
    expect(trigger).toHaveAttribute('aria-expanded', 'false');
    expect(trigger).toHaveAttribute('type', 'button');
    const body = document.getElementById(trigger.getAttribute('aria-controls')!)!;
    expect(body).not.toBeVisible();
    expect(body).toBeEmptyDOMElement();
    expect(screen.queryByText('Chart body')).not.toBeInTheDocument();
    // The content icon leads the label; the chevron trails it.
    expect([...trigger.querySelectorAll('svg')].map((svg) => svg.classList[1])).toEqual([
      'lucide-chart-column-big',
      'lucide-chevron-down',
    ]);
  });

  it('expands and collapses through the trigger', async () => {
    render(<Panel />);
    await userEvent.click(screen.getByRole('button', { name: 'Show charts' }));
    const trigger = screen.getByRole('button', { name: 'Hide charts' });
    expect(trigger).toHaveAttribute('aria-expanded', 'true');
    expect(screen.getByRole('region')).toHaveAttribute('data-expanded', 'true');
    expect(screen.getByText('Chart body')).toBeVisible();
    await userEvent.click(trigger);
    expect(screen.getByRole('button', { name: 'Show charts' })).toBeInTheDocument();
    expect(screen.queryByText('Chart body')).not.toBeInTheDocument();
  });

  it('draws the trend icon and honours a disabled trigger', async () => {
    const change = vi.fn();
    render(
      <Panel
        content="trend"
        showLabel="Show chart"
        hideLabel="Hide chart"
        expanded
        onExpandedChange={change}
        disabled
      />,
    );
    const trigger = screen.getByRole('button', { name: 'Hide chart' });
    expect(trigger).toBeDisabled();
    expect(trigger.querySelector('svg')).toHaveClass('lucide-chart-no-axes-combined');
    await userEvent.click(trigger);
    expect(change).not.toHaveBeenCalled();
  });
});

describe('ChartCell', () => {
  it('names the figure by its title and shows the total, unit, context and footer', () => {
    render(
      <ChartCells>
        <ChartCell
          title="Age distribution"
          total={48}
          unit="PRs"
          context="Current open"
          footer={<span>Legend</span>}
        >
          <span>Bars</span>
        </ChartCell>
        <ChartCell title="Human reviewers" total={0}>
          <span>Zero bars</span>
        </ChartCell>
        <ChartCell title="Current human approvals">
          <span>No total</span>
        </ChartCell>
      </ChartCells>,
    );
    const age = screen.getByRole('figure', { name: 'Age distribution' });
    expect(age.querySelector('figcaption')).toHaveTextContent(/^Age distribution48 PRs$/);
    expect(age).toHaveTextContent('Current open');
    expect(age).toHaveTextContent('Legend');
    // A known zero is a total; an absent total draws nothing.
    expect(
      screen.getByRole('figure', { name: 'Human reviewers' }).querySelector('figcaption'),
    ).toHaveTextContent(/^Human reviewers0$/);
    const approvals = screen.getByRole('figure', { name: 'Current human approvals' });
    expect(approvals.querySelector('figcaption')).toHaveTextContent(/^Current human approvals$/);
    expect(approvals.querySelectorAll('p')).toHaveLength(0);
  });
});
