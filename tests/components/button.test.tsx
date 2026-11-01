import { createRef } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Button, type ButtonSize, type ButtonVariant } from '@/components/ui/button';

const variants: ButtonVariant[] = ['primary', 'secondary', 'ghost', 'destructive'];
const sizes: ButtonSize[] = ['sm', 'md', 'lg', 'icon-sm', 'icon'];

describe('Button', () => {
  it('defaults to a 34px secondary button and forwards its reference and native props', async () => {
    const ref = createRef<HTMLButtonElement>();
    const click = vi.fn();
    render(
      <Button ref={ref} type="button" onClick={click}>
        Columns
      </Button>,
    );
    const button = screen.getByRole('button', { name: 'Columns' });
    expect(ref.current).toBe(button);
    expect(button).toHaveAttribute('type', 'button');
    expect(button).toHaveClass('h-[34px]', 'border-input', 'bg-overlay');
    await userEvent.click(button);
    expect(click).toHaveBeenCalledTimes(1);
  });

  it('draws the orange action fill only for primary', () => {
    render(
      <>
        {variants.map((variant) => (
          <Button key={variant} variant={variant}>
            {variant}
          </Button>
        ))}
      </>,
    );
    for (const variant of variants)
      expect(
        screen.getByRole('button', { name: variant }).classList.contains('bg-action'),
        variant,
      ).toBe(variant === 'primary');
  });

  it('gives every size its own height and 40px on a coarse pointer', () => {
    render(
      <>
        {sizes.map((size) => (
          <Button key={size} size={size} aria-label={size} />
        ))}
      </>,
    );
    const heights: Record<ButtonSize, string> = {
      sm: 'h-7',
      md: 'h-[34px]',
      lg: 'h-10',
      'icon-sm': 'size-7',
      icon: 'size-[34px]',
    };
    for (const size of sizes) {
      const button = screen.getByRole('button', { name: size });
      expect(button, size).toHaveClass(heights[size]);
      if (size !== 'lg')
        expect(button.className, size).toMatch(/(^|\s)pointer-coarse:(h|size)-10(\s|$)/);
    }
  });

  it('sets Inter 700 only on a primary lg button', () => {
    render(
      <>
        {variants.flatMap((variant) =>
          sizes.map((size) => (
            <Button
              key={variant + size}
              variant={variant}
              size={size}
              aria-label={variant + size}
            />
          )),
        )}
      </>,
    );
    for (const variant of variants)
      for (const size of sizes)
        expect(
          screen.getByRole('button', { name: variant + size }).classList.contains('font-bold'),
          variant + ' ' + size,
        ).toBe(variant === 'primary' && size === 'lg');
  });

  it('mutes only icon-only ghost buttons until they are hovered', () => {
    render(
      <>
        {variants.flatMap((variant) =>
          sizes.map((size) => (
            <Button
              key={variant + size}
              variant={variant}
              size={size}
              aria-label={variant + size}
            />
          )),
        )}
      </>,
    );
    for (const variant of variants)
      for (const size of sizes) {
        const button = screen.getByRole('button', { name: variant + size });
        const muted = variant === 'ghost' && (size === 'icon-sm' || size === 'icon');
        expect(button.classList.contains('text-muted-foreground'), variant + ' ' + size).toBe(
          muted,
        );
        expect(button.classList.contains('hover:text-foreground'), variant + ' ' + size).toBe(
          muted,
        );
      }
  });

  it('renders its child element with the button classes when asChild is set', () => {
    render(
      <Button asChild variant="ghost" className="consumer-layout">
        <a href="https://github.com/prebid">Repositories</a>
      </Button>,
    );
    const link = screen.getByRole('link', { name: 'Repositories' });
    expect(link).toHaveAttribute('href', 'https://github.com/prebid');
    expect(link).toHaveClass('hover:bg-ghost-hover', 'consumer-layout');
    expect(screen.queryByRole('button')).not.toBeInTheDocument();
  });

  it('does not act while disabled', async () => {
    const click = vi.fn();
    render(
      <Button variant="primary" disabled onClick={click}>
        Apply
      </Button>,
    );
    const button = screen.getByRole('button', { name: 'Apply' });
    expect(button).toBeDisabled();
    await userEvent.click(button);
    expect(click).not.toHaveBeenCalled();
  });
});
