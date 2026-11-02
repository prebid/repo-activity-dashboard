import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { Callout, calloutTones } from '@/components/feedback/callout';

const glyphs = { info: 'info', warning: 'triangle-alert', error: 'circle-alert' } as const;

describe('Callout', () => {
  it.each(calloutTones)('draws the %s tone with its own icon and no live role', (tone) => {
    const { container } = render(<Callout tone={tone}>Body text</Callout>);
    const box = container.firstElementChild!;
    expect(box.tagName).toBe('DIV');
    expect(box).toHaveAttribute('data-tone', tone);
    expect(box).not.toHaveAttribute('role');
    const icons = box.querySelectorAll('svg');
    expect(icons).toHaveLength(1);
    expect(icons[0]).toHaveClass('lucide-' + glyphs[tone]);
    expect(icons[0]).toHaveAttribute('width', '16');
    expect(icons[0]).toHaveAttribute('aria-hidden', 'true');
    expect(box).toHaveTextContent(/^Body text$/);
    expect(box.querySelector('strong')).toBeNull();
  });

  it('puts the lead before the body in one text flow', () => {
    const { container } = render(
      <Callout tone="warning" lead="Data coverage">
        Two repositories have partial history.
      </Callout>,
    );
    const lead = container.querySelector('strong')!;
    expect(lead).toHaveTextContent('Data coverage');
    expect(lead.parentElement!.tagName).toBe('DIV');
    expect(container.firstElementChild).toHaveTextContent(
      /^Data coverage Two repositories have partial history\.$/,
    );
  });

  it('keeps a paragraph to phrasing content', () => {
    const { container } = render(
      <Callout tone="info" as="p" lead="Note">
        Inline body
      </Callout>,
    );
    const box = container.firstElementChild!;
    expect(box.tagName).toBe('P');
    expect(box.querySelectorAll('div')).toHaveLength(0);
    expect(box.querySelector('strong')!.parentElement!.tagName).toBe('SPAN');
  });

  it('passes the element, role, label and id a site already uses', () => {
    render(
      <>
        <Callout tone="warning" as="aside" aria-label="Timeline data coverage" id="coverage">
          Partial
        </Callout>
        <Callout tone="error" role="alert">
          Export failed
        </Callout>
        <Callout tone="info" role="status">
          Link limit
        </Callout>
      </>,
    );
    const aside = screen.getByRole('complementary', { name: 'Timeline data coverage' });
    expect(aside.tagName).toBe('ASIDE');
    expect(aside).toHaveAttribute('id', 'coverage');
    expect(screen.getByRole('alert')).toHaveTextContent('Export failed');
    expect(screen.getByRole('status')).toHaveTextContent('Link limit');
  });
});
