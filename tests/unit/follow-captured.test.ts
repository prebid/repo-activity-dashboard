import { afterEach, expect, it, vi } from 'vitest';
import { followCaptured } from '@/lib/navigation/follow-captured';
import { pendingTableQuery } from '@/lib/presentation/table-controller';

const click = (patch: Partial<Parameters<typeof followCaptured>[0]> = {}) => ({
  button: 0,
  metaKey: false,
  ctrlKey: false,
  shiftKey: false,
  altKey: false,
  preventDefault: vi.fn(),
  ...patch,
});
afterEach(() => window.history.replaceState(null, '', '/'));
it('freezes the list state into history before following the link', () => {
  window.history.replaceState(null, '', '/repos/prebidjs?prs.q=a');
  const event = click(),
    navigate = vi.fn();
  followCaptured(event, () => ({ origin: '/repos/prebidjs?prs.q=ab', href: '/next' }), navigate);
  expect(event.preventDefault).toHaveBeenCalled();
  expect(window.location.search).toBe('?prs.q=ab');
  expect(navigate).toHaveBeenCalledWith('/next');
});
it('leaves modified clicks and missing destinations to the browser unless a reason is shown', () => {
  const capture = vi.fn(() => ({ href: null })),
    navigate = vi.fn();
  for (const modifier of [
    { metaKey: true },
    { ctrlKey: true },
    { shiftKey: true },
    { altKey: true },
    { button: 1 },
  ]) {
    const event = click(modifier);
    followCaptured(event, capture, navigate);
    expect(event.preventDefault).not.toHaveBeenCalled();
  }
  expect(capture).not.toHaveBeenCalled();
  const plain = click();
  followCaptured(plain, capture, navigate);
  expect(plain.preventDefault).not.toHaveBeenCalled();
  const rejected = click(),
    onRejected = vi.fn();
  followCaptured(rejected, capture, navigate, onRejected);
  expect(rejected.preventDefault).toHaveBeenCalled();
  expect(onRejected).toHaveBeenCalled();
  expect(navigate).not.toHaveBeenCalled();
});
it('keeps the page while a search is unchanged and restarts it when the typed search differs', () => {
  const query = { search: 'a', sort: 'number', descending: true, page: 3 };
  expect(pendingTableQuery({ query, draftSearch: 'a' })).toEqual(query);
  expect(pendingTableQuery({ query, draftSearch: 'ab' })).toEqual({
    ...query,
    search: 'ab',
    page: 1,
  });
});
