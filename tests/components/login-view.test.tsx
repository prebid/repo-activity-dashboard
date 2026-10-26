import { beforeEach, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { LoginView } from '@/features/authentication/login-view';

const mocks = vi.hoisted(() => ({
  signIn: vi.fn(),
  replace: vi.fn(),
  refresh: vi.fn(),
  notify: vi.fn(),
}));
vi.mock('next-auth/react', () => ({ signIn: mocks.signIn }));
vi.mock('next/navigation', () => ({
  useRouter: () => ({ replace: mocks.replace, refresh: mocks.refresh }),
}));
vi.mock('@/components/providers/auth-transitions', () => ({ notifyAuthTransition: mocks.notify }));
beforeEach(() => {
  vi.resetAllMocks();
});

function fillAndSubmit() {
  fireEvent.change(screen.getByLabelText('Email', { exact: true }), {
    target: { value: 'person@example.test' },
  });
  fireEvent.change(screen.getByLabelText('Password', { exact: true }), {
    target: { value: 'TemporaryPassword1!' },
  });
  fireEvent.submit(screen.getByRole('button', { name: 'Sign in' }).closest('form')!);
}

it('keeps the destination through failed sign-in and retry', async () => {
  const destination = '/repos/prebid-js?list=open&page=2';
  mocks.signIn
    .mockResolvedValueOnce({ ok: false, error: 'CredentialsSignin' })
    .mockResolvedValueOnce({ ok: true });
  render(<LoginView preview={false} callbackUrl={destination} />);
  fillAndSubmit();
  await screen.findByRole('alert');
  expect(mocks.replace).not.toHaveBeenCalled();
  expect(screen.getByLabelText('Email', { exact: true })).toHaveValue('person@example.test');
  expect(screen.getByRole('button', { name: 'Sign in' })).toBeEnabled();
  fillAndSubmit();
  await waitFor(() => expect(mocks.replace).toHaveBeenCalledWith(destination));
  expect(mocks.notify).toHaveBeenCalledOnce();
});

it('prevents further input during sign-in and recovers after a transport failure', async () => {
  let reject!: (error: Error) => void;
  mocks.signIn.mockReturnValue(
    new Promise((_resolve, fail) => {
      reject = fail;
    }),
  );
  render(<LoginView preview={false} />);
  fillAndSubmit();
  expect(screen.getByLabelText('Email', { exact: true })).toBeDisabled();
  expect(screen.getByRole('button', { name: 'Show password' })).toBeDisabled();
  reject(new Error('Test network failure'));
  await screen.findByRole('alert');
  expect(screen.getByLabelText('Email', { exact: true })).toBeEnabled();
  expect(mocks.replace).not.toHaveBeenCalled();
});

it('falls back to All Repos for an external destination', async () => {
  mocks.signIn.mockResolvedValue({ ok: true });
  render(<LoginView preview={false} callbackUrl="https://example.test/elsewhere" />);
  fillAndSubmit();
  await waitFor(() => expect(mocks.replace).toHaveBeenCalledWith('/repos'));
});
