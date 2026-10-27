import { beforeEach, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import AdminUsersView from '@/features/administration/users-view';
import { Toolbar } from '@/components/layout/toolbar';
import { LoginView } from '@/features/authentication/login-view';
import { PageError } from '@/components/feedback/page-error';
const mocks = vi.hoisted(() => ({
  replace: vi.fn(),
  refresh: vi.fn(),
  signOut: vi.fn(),
  signIn: vi.fn(),
  notify: vi.fn(),
}));
vi.mock('next/navigation', () => ({
  useRouter: () => ({ replace: mocks.replace, refresh: mocks.refresh }),
}));
vi.mock('next-auth/react', () => ({ signOut: mocks.signOut, signIn: mocks.signIn }));
vi.mock('@/components/providers/auth-transitions', () => ({ notifyAuthTransition: mocks.notify }));
beforeEach(() => vi.resetAllMocks());
const viewer = {
  id: 'fixture',
  email: 'fixture@example.test',
  role: 'admin' as const,
  authVersion: 1,
};
it('does not report a failed sign-out as success', async () => {
  mocks.signOut.mockResolvedValue({ url: 'http://localhost/auth/login?error=MissingCSRF' });
  render(<Toolbar viewer={viewer} repositories={[]} />);
  fireEvent.click(screen.getByRole('button', { name: 'Sign out' }));
  await screen.findByText('Sign-out could not be confirmed. Please try again.');
  expect(mocks.replace).not.toHaveBeenCalled();
  expect(mocks.notify).not.toHaveBeenCalled();
  mocks.signOut.mockResolvedValue({ url: 'http://localhost/auth/login' });
  fireEvent.click(screen.getByRole('button', { name: 'Sign out' }));
  await waitFor(() => expect(mocks.replace).toHaveBeenCalledWith('/auth/login'));
  expect(mocks.signOut).toHaveBeenCalledWith({ redirect: false, redirectTo: '/auth/login' });
});
it('requests fresh server data when retrying a failed page', () => {
  const reset = vi.fn();
  render(<PageError reset={reset} />);
  fireEvent.click(screen.getByRole('button', { name: 'Try again' }));
  expect(mocks.refresh).toHaveBeenCalledOnce();
  expect(reset).toHaveBeenCalledOnce();
});
it('explains expired temporary credentials without changing other rejected sign-ins', async () => {
  mocks.signIn.mockResolvedValue({
    ok: false,
    error: 'CredentialsSignin',
    code: 'temporary_expired',
  });
  render(<LoginView preview={false} />);
  fireEvent.submit(screen.getByRole('button', { name: 'Sign in' }).closest('form')!);
  await screen.findByText('Temporary password expired. Ask an administrator to reissue it.');
  mocks.signIn.mockResolvedValue({ ok: false, error: 'CredentialsSignin' });
  fireEvent.submit(screen.getByRole('button', { name: 'Sign in' }).closest('form')!);
  await screen.findByText('Unable to sign in. Check your details and try again.');
});
it.each(['create', 'reissue'] as const)(
  'gives outcome-unknown guidance when %s loses its response',
  async (operation) => {
    const fetcher = vi.fn<typeof fetch>().mockImplementation((_input, init) =>
      init?.method === 'POST'
        ? Promise.reject(new TypeError('Failed to fetch'))
        : Promise.resolve(
            Response.json({
              users: [
                {
                  email: viewer.email,
                  accountId: viewer.id,
                  role: viewer.role,
                  status: 'active',
                },
              ],
            }),
          ),
    );
    vi.stubGlobal('fetch', fetcher);
    render(<AdminUsersView />);
    await screen.findByRole('button', { name: 'Reissue password for ' + viewer.email });
    if (operation === 'create')
      fireEvent.submit(screen.getByRole('button', { name: 'Create account' }).closest('form')!);
    else
      fireEvent.click(screen.getByRole('button', { name: 'Reissue password for ' + viewer.email }));
    await screen.findByText(
      operation === 'create' ? /It may have succeeded/ : /A new password may have been issued/,
    );
    expect(screen.queryByText('Failed to fetch')).not.toBeInTheDocument();
    expect(fetcher.mock.calls.filter(([, init]) => init?.method === 'POST')).toHaveLength(1);
  },
);
