import { createRef } from 'react';
import { expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { PasswordInput } from '@/components/ui/password-input';

it('preserves the input styling, reference and native props supplied by its caller', () => {
  const ref = createRef<HTMLInputElement>();
  render(
    <PasswordInput
      ref={ref}
      aria-label="Account password"
      className="consumer-style"
      name="password"
      autoComplete="new-password"
      readOnly
      value="simple"
    />,
  );
  const input = screen.getByLabelText('Account password');
  expect(input).toHaveClass('consumer-style');
  expect(ref.current).toBe(input);
  expect(input).toHaveAttribute('autocomplete', 'new-password');
  expect(input).toHaveAttribute('readonly');
  expect(input).toHaveValue('simple');
});

it('gives each unnamed instance an independent visibility control without submitting', async () => {
  const submit = vi.fn((event: React.FormEvent) => event.preventDefault());
  render(
    <form onSubmit={submit}>
      <PasswordInput aria-label="First password" defaultValue="simple" />
      <PasswordInput
        aria-label="Second password"
        visibilityLabel="second password"
        defaultValue="second"
      />
    </form>,
  );
  const first = screen.getByLabelText('First password');
  const second = screen.getByLabelText('Second password');
  expect(first.id).not.toBe('');
  expect(second.id).not.toBe(first.id);
  const show = screen.getByRole('button', { name: 'Show password' });
  expect(show).toHaveAttribute('aria-controls', first.id);
  await userEvent.click(show);
  expect(first).toHaveAttribute('type', 'text');
  expect(second).toHaveAttribute('type', 'password');
  await userEvent.keyboard('{Enter}');
  expect(first).toHaveAttribute('type', 'password');
  expect(submit).not.toHaveBeenCalled();
});

it('keeps an explicit id and disables both editing and revealing when disabled', async () => {
  render(
    <PasswordInput
      id="fixed-password"
      aria-label="Disabled password"
      disabled
      defaultValue="simple"
    />,
  );
  const input = screen.getByLabelText('Disabled password');
  expect(input).toHaveAttribute('id', 'fixed-password');
  expect(input).toBeDisabled();
  const button = screen.getByRole('button', { name: 'Show password' });
  expect(button).toBeDisabled();
  await userEvent.click(button);
  expect(input).toHaveAttribute('type', 'password');
});
