import { useState } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Pager, type PagerProps } from '@/components/tables/pager';

function Stateful(props: Omit<PagerProps, 'page' | 'onPageChange'> & { initial: number }) {
  const [page, setPage] = useState(props.initial);
  return <Pager {...props} page={page} onPageChange={setPage} />;
}

describe('Pager', () => {
  it('renders nothing when there is one page or none', () => {
    const { container, rerender } = render(
      <Pager page={1} pageCount={1} onPageChange={vi.fn()} label="Rows pages" />,
    );
    expect(container).toBeEmptyDOMElement();
    rerender(<Pager page={1} pageCount={0} onPageChange={vi.fn()} label="Rows pages" />);
    expect(container).toBeEmptyDOMElement();
  });

  it('moves between pages and disables the control at each end', async () => {
    render(<Stateful initial={1} pageCount={3} label="Rows pages" />);
    const nav = screen.getByRole('navigation', { name: 'Rows pages' });
    const previous = screen.getByRole('button', { name: 'Previous' });
    const next = screen.getByRole('button', { name: 'Next' });
    expect(nav).toHaveTextContent('Page 1 of 3');
    expect(previous).toBeDisabled();
    expect(next).toBeEnabled();
    await userEvent.click(next);
    expect(nav).toHaveTextContent('Page 2 of 3');
    expect(previous).toBeEnabled();
    await userEvent.click(next);
    expect(nav).toHaveTextContent('Page 3 of 3');
    expect(next).toBeDisabled();
    await userEvent.click(previous);
    expect(nav).toHaveTextContent('Page 2 of 3');
  });

  it('announces the position politely and draws decorative chevrons', () => {
    const { container } = render(
      <Pager page={2} pageCount={4} onPageChange={vi.fn()} label="Rows pages" />,
    );
    expect(screen.getByText('Page 2 of 4')).toHaveAttribute('aria-live', 'polite');
    const icons = container.querySelectorAll('svg');
    expect(icons).toHaveLength(2);
    for (const icon of icons) expect(icon).toHaveAttribute('aria-hidden', 'true');
    for (const button of screen.getAllByRole('button')) expect(button).toHaveClass('h-[34px]');
  });

  it('disables both buttons while disabled', async () => {
    const change = vi.fn();
    render(<Pager page={2} pageCount={4} onPageChange={change} label="Rows pages" disabled />);
    for (const button of screen.getAllByRole('button')) {
      expect(button).toBeDisabled();
      await userEvent.click(button);
    }
    expect(change).not.toHaveBeenCalled();
  });

  it('takes the 28px dialog size and its own wording', async () => {
    const change = vi.fn();
    render(
      <Pager
        page={2}
        pageCount={3}
        onPageChange={change}
        label="Timeline period windows"
        size="sm"
        labels={{
          previous: 'Earlier',
          next: 'Later',
          position: (page, count) => `Window ${page} of ${count}`,
        }}
      />,
    );
    expect(screen.getByText('Window 2 of 3')).toHaveClass('text-small');
    await userEvent.click(screen.getByRole('button', { name: 'Earlier' }));
    await userEvent.click(screen.getByRole('button', { name: 'Later' }));
    expect(change.mock.calls).toEqual([[1], [3]]);
    for (const button of screen.getAllByRole('button')) expect(button).toHaveClass('h-7');
  });
});
