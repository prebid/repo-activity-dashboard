import { afterEach, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import Link from 'next/link';
import { LinkPending } from '@/components/navigation/link-pending';

// Vitest resolves next/link to the Pages Router copy, whose status is always idle.
const linkStatus = vi.hoisted(() => ({ pending: false }));
vi.mock('next/link', async (importOriginal) => ({
  ...(await importOriginal<typeof import('next/link')>()),
  useLinkStatus: () => linkStatus,
}));
afterEach(() => {
  linkStatus.pending = false;
});
it.each([
  ['an idle link', 'false', false, undefined],
  ['a pending link', 'true', true, undefined],
  ['an explicit pending value on an idle link', 'true', false, true],
  ['an explicit idle value on a pending link', 'false', true, false],
])('marks %s data-pending=%s', (_, expected, status, pending) => {
  linkStatus.pending = status;
  render(
    <Link href="/contributors">
      Contributions
      <LinkPending pending={pending} />
    </Link>,
  );
  const link = screen.getByRole('link', { name: 'Contributions' });
  const indicator = link.lastElementChild;
  expect(indicator).toHaveAttribute('data-link-pending');
  expect(indicator).toHaveAttribute('data-pending', expected);
  expect(indicator).toHaveAttribute('aria-hidden', 'true');
  expect(indicator).toBeEmptyDOMElement();
  expect(link).toHaveTextContent(/^Contributions$/);
});
