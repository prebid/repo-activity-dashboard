import { expect, it, vi } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { renderToString } from 'react-dom/server';
import NotFound from '@/app/not-found';
import RepositoryNotFound from '@/app/(dashboard)/repos/[slug]/not-found';
import RootError from '@/app/error';
import GlobalError from '@/app/global-error';

const router = vi.hoisted(() => ({ refresh: vi.fn() }));
vi.mock('next/navigation', () => ({ useRouter: () => router }));
vi.mock('next/image', () => ({
  default: (props: { alt: string; src: string }) => (
    <span role="img" aria-label={props.alt} data-src={props.src} />
  ),
}));

it('brands the missing page and leads back to the repositories', () => {
  render(<NotFound />);
  const main = screen.getByRole('main');
  expect(within(main).getByRole('heading', { level: 1 })).toHaveTextContent(/^Page not found$/);
  expect(within(main).getByRole('img', { name: 'Prebid' })).toHaveAttribute(
    'data-src',
    '/images/prebid-logo.svg',
  );
  expect(within(main).getByRole('link', { name: 'Back to all repositories' })).toHaveAttribute(
    'href',
    '/repos',
  );
  expect(screen.getByRole('contentinfo')).toHaveTextContent(
    /^Private workspace\. Access by invitation\.$/,
  );
});

it('names a missing repository with the page h1 inside the dashboard frame', () => {
  render(<RepositoryNotFound />);
  expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent(/^Repository not found$/);
  expect(screen.getByRole('link', { name: 'Back to all repositories' })).toHaveAttribute(
    'href',
    '/repos',
  );
  // The dashboard frame supplies the landmarks.
  expect(screen.queryByRole('main')).not.toBeInTheDocument();
  expect(screen.queryByRole('contentinfo')).not.toBeInTheDocument();
});

it('retries a failed layout from the branded edge frame', async () => {
  const reset = vi.fn();
  render(<RootError reset={reset} />);
  const main = screen.getByRole('main');
  expect(within(main).getByRole('heading', { name: 'This page could not load' })).toBeVisible();
  await userEvent.click(within(main).getByRole('button', { name: 'Try again' }));
  expect(router.refresh).toHaveBeenCalledOnce();
  expect(reset).toHaveBeenCalledOnce();
});

it('replaces the root layout with a branded document when the application fails', () => {
  // The page is a whole document, so it is rendered as markup rather than into a container.
  const page = new DOMParser().parseFromString(renderToString(<GlobalError />), 'text/html');
  const text = (selector: string) =>
    [...page.querySelectorAll(selector)].map((element) => element.textContent);
  expect(text('main h1')).toEqual(['The application could not load']);
  expect(text('main button')).toEqual(['Try again']);
  expect(text('body > * > footer')).toEqual(['Private workspace. Access by invitation.']);
});
