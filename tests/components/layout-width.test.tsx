import { afterEach, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { DashboardFrame } from '@/components/layout/dashboard-frame';
import { LayoutWidthToggle } from '@/components/layout/layout-width';
import {
  layoutWidthCookieString,
  parseLayoutWidth,
  type LayoutWidth,
} from '@/lib/presentation/layout-width';

afterEach(() => {
  document.cookie = 'dashboard-layout-width=; Path=/; Max-Age=0';
});

function frame(layoutWidth?: LayoutWidth) {
  return render(
    <DashboardFrame layoutWidth={layoutWidth} navigation={<LayoutWidthToggle />}>
      <p>Report</p>
    </DashboardFrame>,
  );
}

it('defaults to full width and saves each switch for the next server render', async () => {
  const user = userEvent.setup();
  const view = frame();
  const surface = view.container.querySelector('[data-layout-width]');
  const toggle = screen.getByRole('button', { name: 'Full-width layout' });
  expect(surface).toHaveAttribute('data-layout-width', 'wide');
  expect(toggle).toHaveAttribute('aria-pressed', 'true');
  expect(toggle).toHaveAttribute('title', 'Switch to contained width');
  await user.click(toggle);
  expect(surface).toHaveAttribute('data-layout-width', 'contained');
  expect(toggle).toHaveAttribute('aria-pressed', 'false');
  expect(toggle).toHaveAttribute('title', 'Switch to full width');
  expect(document.cookie).toBe('dashboard-layout-width=contained');
  await user.click(toggle);
  expect(surface).toHaveAttribute('data-layout-width', 'wide');
  expect(document.cookie).toBe('dashboard-layout-width=wide');
});

it('starts from the width the server read', () => {
  const view = frame('contained');
  expect(view.container.querySelector('[data-layout-width]')).toHaveAttribute(
    'data-layout-width',
    'contained',
  );
  expect(screen.getByRole('button', { name: 'Full-width layout' })).toHaveAttribute(
    'aria-pressed',
    'false',
  );
});

it('refuses to render outside the dashboard frame', () => {
  vi.spyOn(console, 'error').mockImplementation(() => {});
  expect(() => render(<LayoutWidthToggle />)).toThrow('requires the dashboard frame');
});

it.each([
  [undefined, 'wide'],
  ['wide', 'wide'],
  ['contained', 'contained'],
  ['Contained', 'wide'],
  ['', 'wide'],
])('reads a saved width of %j as %s', (saved, width) => {
  expect(parseLayoutWidth(saved)).toBe(width);
});

it('marks the saved width Secure only on HTTPS', () => {
  expect(layoutWidthCookieString('contained', false)).toBe(
    'dashboard-layout-width=contained; Path=/; Max-Age=31536000; SameSite=Lax',
  );
  expect(layoutWidthCookieString('wide', true)).toBe(
    'dashboard-layout-width=wide; Path=/; Max-Age=31536000; SameSite=Lax; Secure',
  );
});
