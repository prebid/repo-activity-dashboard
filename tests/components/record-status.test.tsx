import { render } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { RecordStatus, type RecordStatusProps } from '@/components/github/record-status';

const cases: [RecordStatusProps, string, string, string][] = [
  [{ kind: 'pr', status: 'open' }, 'Open', 'git-pull-request-arrow', 'success'],
  [{ kind: 'pr', status: 'draft' }, 'Draft', 'git-pull-request-draft', 'muted'],
  [{ kind: 'pr', status: 'merged' }, 'Merged', 'git-merge', 'link'],
  [{ kind: 'pr', status: 'closed' }, 'Closed', 'git-pull-request-closed', 'error'],
  [{ kind: 'issue', status: 'open' }, 'Open', 'circle-dot', 'success'],
  [{ kind: 'issue', status: 'closed' }, 'Closed', 'circle-check-big', 'muted'],
];

describe('RecordStatus', () => {
  it.each(cases)('%j reads %s with its glyph', (record, label, glyph, tone) => {
    const { container } = render(<RecordStatus {...record} />);
    const status = container.firstElementChild!;
    // Record filters and searches read data-state and the text.
    expect(status).toHaveAttribute('data-state', label);
    expect(status.textContent).toBe(label);
    expect(status).toHaveAttribute('data-tone', tone);
    const icons = status.querySelectorAll('svg');
    expect(icons).toHaveLength(1);
    expect(icons[0]).toHaveClass('lucide-' + glyph);
    expect(icons[0]).toHaveAttribute('width', '14');
    expect(icons[0]).toHaveAttribute('aria-hidden', 'true');
  });
});
