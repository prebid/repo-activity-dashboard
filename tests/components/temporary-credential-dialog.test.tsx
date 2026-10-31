import { useRef, useState } from 'react';
import { it, expect, vi } from 'vitest';
import { render, screen, within, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { TemporaryCredentialDialog } from '@/features/administration/temporary-credential-dialog';
const credential = {
  email: 'person@example.test',
  tempPassword: 'Synthetic-only-123',
  expiresAt: '2099-01-01T00:00:00.000Z',
};
function Harness() {
  const [open, setOpen] = useState(false);
  const trigger = useRef<HTMLButtonElement>(null);
  return (
    <>
      <button ref={trigger} onClick={() => setOpen(true)}>
        Issue credential
      </button>
      {open && (
        <TemporaryCredentialDialog
          credential={credential}
          onClose={() => setOpen(false)}
          onRestoreFocus={() => trigger.current?.focus()}
        />
      )}
    </>
  );
}
it('confirms accidental dismissal, clears the dialog, and restores focus', async () => {
  const user = userEvent.setup();
  render(<Harness />);
  await user.click(screen.getByRole('button', { name: 'Issue credential' }));
  expect(screen.getByRole('textbox', { name: 'Temporary password' })).toHaveValue(
    credential.tempPassword,
  );
  await user.keyboard('{Escape}');
  expect(screen.getByRole('button', { name: 'Discard and close' })).toBeVisible();
  await user.click(screen.getByRole('button', { name: 'Keep password open' }));
  expect(screen.getByRole('dialog')).toBeVisible();
  await user.keyboard('{Escape}');
  await user.click(screen.getByRole('button', { name: 'Discard and close' }));
  await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
  expect(screen.getByRole('button', { name: 'Issue credential' })).toHaveFocus();
  expect(screen.queryByDisplayValue(credential.tempPassword)).not.toBeInTheDocument();
});
it('keeps copy errors inside the active dialog and supports explicit acknowledgement', async () => {
  const user = userEvent.setup();
  vi.spyOn(navigator.clipboard, 'writeText')
    .mockRejectedValueOnce(new Error('denied'))
    .mockResolvedValue(undefined);
  render(<Harness />);
  await user.click(screen.getByRole('button', { name: 'Issue credential' }));
  await user.click(screen.getByRole('button', { name: 'Copy password' }));
  expect(within(screen.getByRole('dialog')).getByRole('alert')).toHaveTextContent('Unable to copy');
  await user.click(screen.getByRole('button', { name: 'Copy password' }));
  expect(screen.getByRole('button', { name: 'Copied' })).toBeVisible();
  await user.click(screen.getByRole('button', { name: 'I have saved the password' }));
  await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
});

it('does not invent an expiry for an existing-backend temporary password', () => {
  render(
    <TemporaryCredentialDialog
      credential={{ ...credential, expiresAt: null }}
      onClose={() => {}}
      onRestoreFocus={() => {}}
    />,
  );
  expect(screen.getByRole('textbox', { name: 'Temporary password' })).toHaveValue(
    credential.tempPassword,
  );
  expect(screen.queryByText(/Expires/)).not.toBeInTheDocument();
  expect(screen.getByText(/must replace it at first sign-in/)).toBeVisible();
});
