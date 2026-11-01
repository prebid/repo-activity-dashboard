import { expect, it, onTestFinished, vi } from 'vitest';
import { startTransition } from 'react';
import { act, fireEvent, renderHook } from '@testing-library/react';
import { usePendingNavigation } from '@/lib/navigation/use-pending-navigation';

const router = vi.hoisted(() => ({ push: vi.fn<(href: string) => void>() }));
vi.mock('next/navigation', () => ({ useRouter: () => router }));

/** Stands in for the App Router, whose push stays in its transition until the destination commits. */
function holdNavigation() {
  let commit!: () => void;
  const destination = new Promise<void>((resolve) => {
    commit = resolve;
  });
  router.push.mockImplementation(() => startTransition(() => destination));
  return () =>
    act(async () => {
      commit();
      await destination;
    });
}
/** A link whose handler prevents the default, as `next/link` does, and may push a key of its own. */
function link(href: string, attributes: Record<string, string> = {}, onClick?: () => void) {
  const anchor = document.createElement('a');
  anchor.setAttribute('href', href);
  for (const [name, value] of Object.entries(attributes)) anchor.setAttribute(name, value);
  anchor.append(document.createElement('span'));
  anchor.addEventListener('click', (event) => {
    event.preventDefault();
    onClick?.();
  });
  document.body.append(anchor);
  onTestFinished(() => anchor.remove());
  return anchor;
}
it('names the pending control until the navigation commits', async () => {
  const commit = holdNavigation();
  const { result } = renderHook(() => usePendingNavigation());
  expect(result.current.pendingKey).toBeNull();
  act(() => result.current.push('/contributors?timeline=1', 'timeline'));
  expect(router.push).toHaveBeenCalledExactlyOnceWith('/contributors?timeline=1');
  expect(result.current.pendingKey).toBe('timeline');
  await commit();
  expect(result.current.pendingKey).toBeNull();
});
it('shows no pending control for a push without a key', async () => {
  const commit = holdNavigation();
  const { result } = renderHook(() => usePendingNavigation());
  act(() => result.current.push('/contributors/account-alice'));
  expect(router.push).toHaveBeenCalledExactlyOnceWith('/contributors/account-alice');
  expect(result.current.pendingKey).toBeNull();
  await commit();
  expect(result.current.pendingKey).toBeNull();
});
it('clears the pending control when a push without a key replaces its navigation', async () => {
  const commit = holdNavigation();
  const { result } = renderHook(() => usePendingNavigation());
  act(() => result.current.push('/contributors?timeline=1', 'timeline'));
  expect(result.current.pendingKey).toBe('timeline');
  act(() => result.current.push('/contributors/account-alice'));
  expect(router.push).toHaveBeenLastCalledWith('/contributors/account-alice');
  expect(result.current.pendingKey).toBeNull();
  await commit();
  expect(result.current.pendingKey).toBeNull();
});
it.each<[string, string, Record<string, string>]>([
  ['a link to another page', '/contributors', {}],
  ['a link to another view of this page', '/?view=issues', {}],
  ['a link that targets this tab', '/contributors', { target: '_self' }],
])('clears the pending control when a click follows %s', async (_, href, attributes) => {
  const commit = holdNavigation();
  const { result } = renderHook(() => usePendingNavigation());
  act(() => result.current.push('/contributors?timeline=1', 'timeline'));
  fireEvent.click(link(href, attributes).firstElementChild!);
  expect(result.current.pendingKey).toBeNull();
  await commit();
  expect(result.current.pendingKey).toBeNull();
  const next = holdNavigation();
  act(() => result.current.push('/companies', 'companies'));
  expect(result.current.pendingKey).toBe('companies');
  await next();
});
it('lets the clicked control name itself after the click clears the earlier key', async () => {
  const commit = holdNavigation();
  const { result } = renderHook(() => usePendingNavigation());
  act(() => result.current.push('/contributors?timeline=1', 'timeline'));
  fireEvent.click(link('/companies', {}, () => result.current.push('/companies', 'companies')));
  expect(router.push).toHaveBeenLastCalledWith('/companies');
  expect(result.current.pendingKey).toBe('companies');
  await commit();
  expect(result.current.pendingKey).toBeNull();
});
it.each<[string, string, Record<string, string>, MouseEventInit]>([
  ['a command-click', '/contributors', {}, { metaKey: true }],
  ['a control-click', '/contributors', {}, { ctrlKey: true }],
  ['a shift-click', '/contributors', {}, { shiftKey: true }],
  ['an option-click', '/contributors', {}, { altKey: true }],
  ['a middle-button click', '/contributors', {}, { button: 1 }],
  ['a link that opens a new tab', '/contributors', { target: '_blank' }, {}],
  ['a download link', '/contributors', { download: '' }, {}],
  ['a link to another origin', 'https://example.com/contributors', {}, {}],
  ['a link to a fragment of this page', '#dashboard-content', {}, {}],
])('keeps the pending control for %s', async (_, href, attributes, init) => {
  const commit = holdNavigation();
  const { result } = renderHook(() => usePendingNavigation());
  act(() => result.current.push('/contributors?timeline=1', 'timeline'));
  fireEvent.click(link(href, attributes), init);
  expect(result.current.pendingKey).toBe('timeline');
  await commit();
});
it('keeps the pending control for a click outside any link', async () => {
  const commit = holdNavigation();
  const { result } = renderHook(() => usePendingNavigation());
  act(() => result.current.push('/contributors?timeline=1', 'timeline'));
  fireEvent.click(document.body);
  expect(result.current.pendingKey).toBe('timeline');
  await commit();
});
