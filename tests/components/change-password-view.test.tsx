import { beforeEach, it, expect, vi } from 'vitest';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { ChangePasswordView } from '@/features/authentication/change-password-view';
import { LoginView } from '@/features/authentication/login-view';

const mocks = vi.hoisted(() => ({
  signIn: vi.fn(),
  signOut: vi.fn(),
  replace: vi.fn(),
  refresh: vi.fn(),
  back: vi.fn(),
  notify: vi.fn(),
}));
vi.mock('next-auth/react', () => ({ signIn: mocks.signIn, signOut: mocks.signOut }));
vi.mock('next/navigation', () => ({
  useRouter: () => ({ replace: mocks.replace, refresh: mocks.refresh, back: mocks.back }),
}));
vi.mock('@/components/providers/auth-transitions', () => ({
  notifyAuthTransition: mocks.notify,
}));
beforeEach(() => {
  vi.resetAllMocks();
  mocks.signIn.mockResolvedValue({ ok: true });
  mocks.signOut.mockResolvedValue({ url: '/auth/login' });
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue(Response.json({ message: 'Password changed' })));
});
function form(callbackUrl?: string) {
  const view = render(
    <ChangePasswordView email="person@example.test" mustChangePassword callbackUrl={callbackUrl} />,
  );
  for (const [label, value] of [
    ['Temporary Password', 'TemporaryPassword1!'],
    ['New Password', 'simple'],
    ['Confirm New Password', 'simple'],
  ])
    fireEvent.change(screen.getByLabelText(label, { exact: true }), { target: { value } });
  fireEvent.submit(
    screen.getByRole('button', { name: 'Set password and continue' }).closest('form')!,
  );
  return view;
}
it('recovers at login when automatic sign-in throws after the password was committed', async () => {
  mocks.signIn.mockRejectedValue(new Error('Controlled sign-in network failure'));
  form();
  await waitFor(() =>
    expect(mocks.replace).toHaveBeenCalledWith('/auth/login?passwordChanged=true'),
  );
  expect(mocks.refresh).toHaveBeenCalledOnce();
  expect(mocks.notify).toHaveBeenCalledOnce();
  expect(screen.getByLabelText('Temporary Password', { exact: true })).toHaveValue('');
  expect(screen.getByLabelText('New Password', { exact: true })).toHaveValue('');
});

it.each([
  [
    '/contributors?search=Alice',
    '/contributors?search=Alice',
    '/auth/login?callbackUrl=%2Fcontributors%3Fsearch%3DAlice',
  ],
  ['https://example.test/elsewhere', '/repos', '/auth/login'],
])(
  'preserves only safe destinations after password change %#',
  async (callbackUrl, destination, loginUrl) => {
    form(callbackUrl);
    expect(screen.getByRole('link', { name: 'Back to sign in' })).toHaveAttribute('href', loginUrl);
    await waitFor(() => expect(mocks.replace).toHaveBeenCalledWith(destination));
  },
);

it('preserves context when a confirmed password change needs manual sign-in', async () => {
  mocks.signIn.mockResolvedValue({ ok: false });
  form('/contributors?search=Alice');
  await waitFor(() =>
    expect(mocks.replace).toHaveBeenCalledWith(
      '/auth/login?passwordChanged=true&callbackUrl=%2Fcontributors%3Fsearch%3DAlice',
    ),
  );
});

it('does not issue another write while a password change is pending', async () => {
  let complete!: (response: Response) => void;
  vi.mocked(fetch).mockReturnValue(
    new Promise((resolve) => {
      complete = resolve;
    }),
  );
  form();
  fireEvent.submit(screen.getByLabelText('New Password', { exact: true }).closest('form')!);
  expect(fetch).toHaveBeenCalledOnce();
  complete(Response.json({ message: 'Password changed' }));
  await waitFor(() => expect(mocks.replace).toHaveBeenCalledWith('/repos'));
});

it('rejects mismatched confirmation without calling the server', () => {
  render(<ChangePasswordView email="person@example.test" mustChangePassword />);
  fireEvent.change(screen.getByLabelText('New Password', { exact: true }), {
    target: { value: 'simple' },
  });
  fireEvent.change(screen.getByLabelText('Confirm New Password', { exact: true }), {
    target: { value: 'different' },
  });
  fireEvent.submit(screen.getByLabelText('New Password', { exact: true }).closest('form')!);
  expect(screen.getByRole('alert')).toHaveTextContent('New passwords do not match');
  expect(fetch).not.toHaveBeenCalled();
});

it('allows ordinary password changes to be cancelled without a write', () => {
  render(<ChangePasswordView email="person@example.test" mustChangePassword={false} />);
  fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
  expect(mocks.back).toHaveBeenCalledOnce();
  expect(fetch).not.toHaveBeenCalled();
});

it('reports unexpected transport errors without claiming a password change', async () => {
  vi.mocked(fetch).mockRejectedValue('Network unavailable');
  form();
  expect(await screen.findByRole('alert')).toHaveTextContent(
    'An unexpected error occurred. Please try again.',
  );
  expect(mocks.signIn).not.toHaveBeenCalled();
});

it('ignores a request rejection after the password form was disposed', async () => {
  let reject!: (error: Error) => void;
  const pending = new Promise<Response>((_resolve, fail) => {
    reject = fail;
  });
  vi.mocked(fetch).mockReturnValue(pending);
  const view = form();
  view.unmount();
  await act(async () => {
    reject(new Error('Aborted'));
    await pending.catch(() => {});
  });
  expect(mocks.signIn).not.toHaveBeenCalled();
  expect(mocks.replace).not.toHaveBeenCalled();
});
it('does not sign in from a replaced form when an earlier password write completes', async () => {
  let complete!: (response: Response) => void;
  const pending = new Promise<Response>((resolve) => {
    complete = resolve;
  });
  vi.mocked(fetch).mockReturnValue(pending);
  const view = form();
  const signal = vi.mocked(fetch).mock.calls[0][1]?.signal;
  view.unmount();
  expect(signal?.aborted).toBe(true);
  await act(async () => {
    complete(Response.json({ message: 'Password changed' }));
    await pending;
  });
  expect(mocks.signIn).not.toHaveBeenCalled();
  expect(mocks.replace).not.toHaveBeenCalled();
  expect(mocks.notify).not.toHaveBeenCalled();
});
it('navigates after successful automatic sign-in and does not send a second password write', async () => {
  form();
  await waitFor(() => expect(mocks.replace).toHaveBeenCalledWith('/repos'));
  expect(fetch).toHaveBeenCalledOnce();
  expect(mocks.signIn).toHaveBeenCalledExactlyOnceWith('credentials', {
    email: 'person@example.test',
    password: 'simple',
    redirect: false,
  });
  expect(mocks.refresh).toHaveBeenCalledOnce();
});
it('keeps a rejected password write correctable without claiming that it succeeded', async () => {
  vi.mocked(fetch).mockResolvedValue(
    Response.json({ error: 'Current password is incorrect' }, { status: 400 }),
  );
  form();
  await screen.findByText('Current password is incorrect');
  expect(mocks.signIn).not.toHaveBeenCalled();
  expect(mocks.replace).not.toHaveBeenCalled();
  expect(screen.getByLabelText('Temporary Password', { exact: true })).toHaveValue(
    'TemporaryPassword1!',
  );
  expect(screen.getByRole('button', { name: 'Set password and continue' })).toBeEnabled();
});
it('recovers after a rejected automatic sign-in without requiring another sign-out request', async () => {
  mocks.signIn.mockResolvedValue({ ok: false, error: 'Configuration' });
  mocks.signOut.mockRejectedValue(new Error('Controlled sign-out failure'));
  form();
  await waitFor(() =>
    expect(mocks.replace).toHaveBeenCalledWith('/auth/login?passwordChanged=true'),
  );
  expect(mocks.signOut).not.toHaveBeenCalled();
});
it('ignores a late automatic sign-in result after the form is replaced', async () => {
  let complete!: (result: { ok: boolean }) => void;
  const pending = new Promise<{ ok: boolean }>((resolve) => {
    complete = resolve;
  });
  mocks.signIn.mockReturnValue(pending);
  const view = form();
  await waitFor(() => expect(mocks.signIn).toHaveBeenCalledOnce());
  view.unmount();
  await act(async () => {
    complete({ ok: true });
    await pending;
  });
  expect(mocks.replace).not.toHaveBeenCalled();
  expect(mocks.notify).not.toHaveBeenCalled();
});
it('explains the committed password change on the recovery login screen', () => {
  render(<LoginView preview={false} passwordChanged />);
  expect(screen.getByRole('status')).toHaveTextContent(
    'Password changed. Sign in with your new password.',
  );
});

it.each([
  ['short', 'Password must be at least 6 characters'],
  ['x'.repeat(73), 'Password must be at most 72 UTF-8 bytes'],
])(
  'shows a specific length error without sending an invalid password',
  async (password, message) => {
    render(<ChangePasswordView email="person@example.test" mustChangePassword />);
    fireEvent.change(screen.getByLabelText('Temporary Password', { exact: true }), {
      target: { value: 'TemporaryPassword1!' },
    });
    fireEvent.change(screen.getByLabelText('New Password', { exact: true }), {
      target: { value: password },
    });
    fireEvent.change(screen.getByLabelText('Confirm New Password', { exact: true }), {
      target: { value: password },
    });
    fireEvent.submit(
      screen.getByRole('button', { name: 'Set password and continue' }).closest('form')!,
    );
    expect(await screen.findByRole('alert')).toHaveTextContent(message);
    expect(fetch).not.toHaveBeenCalled();
  },
);
