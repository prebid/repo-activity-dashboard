import { createRef } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Button, type ButtonSize, type ButtonVariant } from '@/components/ui/button';

const variants: ButtonVariant[] = ['primary', 'secondary', 'ghost', 'masthead', 'destructive'];
const sizes: ButtonSize[] = ['sm', 'md', 'lg', 'icon-sm', 'icon', 'icon-lg'];

// Sizes and fills are geometry and appearance: the browser suite measures the Button stories.
describe('Button', () => {
  it('forwards its reference and native props', async () => {
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
    await userEvent.click(button);
    expect(click).toHaveBeenCalledTimes(1);
  });

  it('renders every variant at every size as a named button', () => {
    render(
      <>
        {variants.flatMap((variant) =>
          sizes.map((size) => (
            <Button
              key={variant + size}
              variant={variant}
              size={size}
              aria-label={variant + ' ' + size}
            />
          )),
        )}
      </>,
    );
    for (const variant of variants)
      for (const size of sizes)
        expect(screen.getByRole('button', { name: variant + ' ' + size })).toBeEnabled();
  });

  it('exposes a pressed masthead toggle and an open masthead menu trigger', () => {
    render(
      <>
        <Button variant="masthead" size="icon-lg" aria-label="Full-width layout" aria-pressed />
        <Button variant="masthead" size="icon-lg" aria-label="Theme settings" aria-expanded />
      </>,
    );
    expect(
      screen.getByRole('button', { name: 'Full-width layout', pressed: true }),
    ).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Theme settings', expanded: true })).toBeEnabled();
  });

  it('renders its child element instead of a button when asChild is set', () => {
    render(
      <Button asChild variant="ghost">
        <a href="https://github.com/prebid">Repositories</a>
      </Button>,
    );
    const link = screen.getByRole('link', { name: 'Repositories' });
    expect(link).toHaveAttribute('href', 'https://github.com/prebid');
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
