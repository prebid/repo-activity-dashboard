import { render } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { DataLegend, measurementMarks } from '@/components/feedback/data-legend';

describe('DataLegend', () => {
  it('explains both value glyphs in one wording by default', () => {
    const { container } = render(<DataLegend />);
    const legend = container.firstElementChild!;
    expect(legend.tagName).toBe('P');
    expect(legend).toHaveTextContent(/^— Not available or not applicable · \* Partial data$/);
    const icon = legend.querySelector('svg')!;
    expect(icon).toHaveClass('lucide-info');
    expect(icon).toHaveAttribute('width', '14');
    expect(
      [...legend.querySelectorAll<HTMLElement>('[data-mark]')].map((entry) => entry.dataset.mark),
    ).toEqual(['missing', 'partial']);
    // The separator is visual only.
    expect(legend.querySelector('[aria-hidden="true"]:not(svg)')).toHaveTextContent('·');
  });

  it('shows only the marks a surface can draw, in the legend order', () => {
    const { container: partial } = render(<DataLegend marks={['partial']} />);
    expect(partial.firstElementChild).toHaveTextContent(/^\* Partial data$/);
    const { container: both } = render(<DataLegend marks={['partial', 'missing']} />);
    expect(both.firstElementChild).toHaveTextContent(
      /^— Not available or not applicable · \* Partial data$/,
    );
  });

  it('derives the marks a set of measurements shows, in the legend order', () => {
    expect(measurementMarks([])).toEqual([]);
    expect(measurementMarks([{ status: 'complete' }])).toEqual([]);
    expect(measurementMarks([{ status: 'complete' }, { status: 'partial' }])).toEqual(['partial']);
    expect(measurementMarks([{ status: 'missing' }])).toEqual(['missing']);
    expect(measurementMarks([{ status: 'not-applicable' }])).toEqual(['missing']);
    expect(
      measurementMarks([
        { status: 'partial' },
        { status: 'not-applicable' },
        { status: 'partial' },
      ]),
    ).toEqual(['missing', 'partial']);
  });

  it('renders nothing without a mark to explain', () => {
    const { container } = render(<DataLegend marks={[]} />);
    expect(container).toBeEmptyDOMElement();
  });
});
