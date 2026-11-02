import { act, render, renderHook, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  deleteRejectedPreference,
  migrateLegacyPreference,
  preferenceChangeEvent,
  readPreference,
  usePreferenceCookie,
  writePreference,
} from '@/lib/navigation/use-preference-cookie';
import { PreferenceNotice } from '@/components/feedback/preference-notice';
import { preferenceSectionKeys, type PreferenceSectionKey } from '@/models/preferences';
import {
  alice,
  preferenceSections,
  rawPreferenceCookie,
  savedSection,
  seedPreferences,
} from '../support/preference-cookies';

const bob = { accountId: 'bob', authVersion: 0 };
const historyWrites = vi.fn();
beforeEach(() => {
  window.history.replaceState(null, '', '/repos');
  for (const method of ['pushState', 'replaceState'] as const)
    vi.spyOn(window.history, method).mockImplementation(historyWrites);
  historyWrites.mockClear();
});
afterEach(() => vi.restoreAllMocks());
function cookieAssignments() {
  return vi.spyOn(Document.prototype, 'cookie', 'set');
}
/** A cookie jar that keeps nothing, as when the browser blocks cookies. */
function blockCookies() {
  vi.spyOn(Document.prototype, 'cookie', 'set').mockImplementation(() => {});
}

describe('field-wise writes', () => {
  it('writes one section and keeps sections other hooks and tabs wrote', () => {
    seedPreferences(alice, { overview: { version: 3 }, 'repository.prs.sort': { sort: 'a' } });
    const changed = vi.fn();
    window.addEventListener(preferenceChangeEvent, changed);
    const assignments = cookieAssignments();
    expect(
      writePreference(alice, 'overview.backlog.sort', { sort: 'name', descending: true }),
    ).toEqual({ status: 'saved', evicted: [] });
    expect(preferenceSections('repositories')).toEqual({
      overview: { version: 3 },
      'repository.prs.sort': { sort: 'a' },
      'overview.backlog.sort': { sort: 'name', descending: true },
    });
    expect(assignments).toHaveBeenCalledOnce();
    expect(assignments.mock.lastCall![0]).toMatch(
      /^dashboard-repositories=[\w-]+; Path=\/; Max-Age=31536000; SameSite=Lax$/,
    );
    expect((changed.mock.lastCall![0] as CustomEvent).detail).toEqual({
      section: 'overview.backlog.sort',
    });
    expect(readPreference(alice, 'overview.backlog.sort')).toBe(
      '{"sort":"name","descending":true}',
    );
    expect(readPreference(bob, 'overview.backlog.sort')).toBeNull();
    window.removeEventListener(preferenceChangeEvent, changed);
    expect(historyWrites).not.toHaveBeenCalled();
  });
  it('deletes a section, and the cookie with its last section', () => {
    seedPreferences(alice, { overview: 1, 'repository.prs.sort': 2 });
    writePreference(alice, 'overview', null);
    expect(preferenceSections('repositories')).toEqual({ 'repository.prs.sort': 2 });
    writePreference(alice, 'repository.prs.sort', null);
    expect(rawPreferenceCookie('repositories')).toBeUndefined();
  });
  it('replaces a cookie bound to another account instead of merging into it', () => {
    seedPreferences(bob, { overview: 'bob' });
    writePreference(alice, 'repository.prs.sort', 'alice');
    expect(preferenceSections('repositories', bob)).toBeNull();
    expect(preferenceSections('repositories')).toEqual({ 'repository.prs.sort': 'alice' });
  });
  it('reports a cookie the browser did not keep', () => {
    blockCookies();
    expect(writePreference(alice, 'overview', 1)).toEqual({ status: 'unavailable' });
    const { result } = renderHook(() => usePreferenceCookie(savedSection('overview')));
    act(() => {
      result.current.write(2);
    });
    expect(result.current.storageAvailable).toBe(false);
  });
  it('writes nothing without a server-supplied section', () => {
    const assignments = cookieAssignments();
    const { result } = renderHook(() => usePreferenceCookie(undefined));
    expect(result.current.write(1)).toBeNull();
    expect(result.current.storageAvailable).toBe(true);
    expect(assignments).not.toHaveBeenCalled();
  });
});

describe('the 3,072-byte cap', () => {
  const sections = preferenceSectionKeys.repositories.slice(0, 4) as PreferenceSectionKey[];
  it('evicts the least recently updated sections and says so until dismissed', async () => {
    const user = userEvent.setup();
    seedPreferences(alice, Object.fromEntries(sections.map((key) => [key, 'x'.repeat(700)])));
    render(<PreferenceNotice />);
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    const { result } = renderHook(() => usePreferenceCookie(savedSection(sections[0])));
    act(() => {
      expect(result.current.write('y'.repeat(700))).toEqual({
        status: 'saved',
        evicted: [sections[1]],
      });
    });
    expect(Object.keys(preferenceSections('repositories')!).sort()).toEqual(
      [sections[0], sections[2], sections[3]].sort(),
    );
    expect(screen.getByRole('alert')).toHaveTextContent(
      'Saved preferences were full, so the least recently changed saved setting was removed.',
    );
    await user.click(screen.getByRole('button', { name: 'Dismiss' }));
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    act(() => {
      writePreference(alice, 'timeline.matrix', 'z'.repeat(1000));
    });
    expect(screen.getByRole('alert')).toHaveTextContent(
      'Saved preferences were full, so the 2 least recently changed saved settings were removed.',
    );
    expect(result.current.storageAvailable).toBe(true);
  });
  it('refuses a choice that alone exceeds the cap and keeps the saved ones', () => {
    seedPreferences(alice, { overview: 'kept' });
    render(<PreferenceNotice />);
    const { result } = renderHook(() => usePreferenceCookie(savedSection('timeline.matrix')));
    act(() => {
      expect(result.current.write('z'.repeat(4000))).toEqual({ status: 'too-large' });
    });
    expect(preferenceSections('repositories')).toEqual({ overview: 'kept' });
    expect(screen.getByRole('alert')).toHaveTextContent(
      'This choice is too large to save. It applies to the current view only.',
    );
    expect(result.current.storageAvailable).toBe(true);
  });
});

describe('after hydration', () => {
  it('deletes a section the server rejected while the cookie still holds that value', () => {
    seedPreferences(alice, { 'overview.backlog.sort': { sort: 3 }, overview: 'kept' });
    renderHook(() =>
      usePreferenceCookie(savedSection('overview.backlog.sort', null, '{"sort":3}')),
    );
    expect(preferenceSections('repositories')).toEqual({ overview: 'kept' });
    expect(historyWrites).not.toHaveBeenCalled();
  });
  it('keeps a newer value written after the server read the rejected one', () => {
    seedPreferences(alice, { 'overview.backlog.sort': { sort: 'name', descending: true } });
    renderHook(() =>
      usePreferenceCookie(savedSection('overview.backlog.sort', null, '{"sort":3}')),
    );
    expect(preferenceSections('repositories')).toEqual({
      'overview.backlog.sort': { sort: 'name', descending: true },
    });
    expect(deleteRejectedPreference(savedSection('overview.backlog.sort'))).toBe(false);
  });
  it('copies a valid legacy value once, for the next request, without changing this render', () => {
    localStorage.setItem('legacy-new', JSON.stringify({ sort: 'name', descending: true }));
    localStorage.setItem('legacy-old', JSON.stringify({ sort: 'old', descending: false }));
    const read = vi.fn((raw: string) => JSON.parse(raw) as unknown);
    const renders: unknown[] = [];
    renderHook(() => {
      const preference = usePreferenceCookie(savedSection('repository.prs.sort'), {
        keys: ['legacy-new', 'legacy-old'],
        read,
      });
      renders.push(preference.storageAvailable);
      return preference;
    });
    expect(preferenceSections('repositories')).toEqual({
      'repository.prs.sort': { sort: 'name', descending: true },
    });
    expect(localStorage.getItem('legacy-new')).toBeNull();
    expect(localStorage.getItem('legacy-old')).toBeNull();
    expect(renders).toEqual([true]);
    expect(historyWrites).not.toHaveBeenCalled();
  });
  it('copies no invalid value and never overrides a cookie value', () => {
    localStorage.setItem('legacy', 'not valid');
    expect(
      migrateLegacyPreference(alice, 'repository.prs.sort', { keys: ['legacy'], read: () => null }),
    ).toBe('invalid');
    expect(rawPreferenceCookie('repositories')).toBeUndefined();
    expect(localStorage.getItem('legacy')).toBeNull();
    seedPreferences(alice, { 'repository.prs.sort': 'current' });
    localStorage.setItem('legacy', '"older"');
    expect(
      migrateLegacyPreference(alice, 'repository.prs.sort', {
        keys: ['legacy'],
        read: (raw) => JSON.parse(raw) as unknown,
      }),
    ).toBe('superseded');
    expect(preferenceSections('repositories')).toEqual({ 'repository.prs.sort': 'current' });
    expect(localStorage.getItem('legacy')).toBeNull();
    expect(
      migrateLegacyPreference(alice, 'repository.prs.sort', { keys: ['legacy'], read: () => 1 }),
    ).toBe('none');
  });
  it('keeps the legacy value when the copy would evict a cookie value or cannot be written', () => {
    seedPreferences(alice, { overview: 'x'.repeat(2000) });
    localStorage.setItem('legacy', JSON.stringify('y'.repeat(1500)));
    const legacy = { keys: ['legacy'], read: (raw: string) => JSON.parse(raw) as unknown };
    expect(migrateLegacyPreference(alice, 'repository.prs.sort', legacy)).toBe('kept');
    expect(preferenceSections('repositories')).toEqual({ overview: 'x'.repeat(2000) });
    expect(localStorage.getItem('legacy')).not.toBeNull();
    writePreference(alice, 'overview', null);
    blockCookies();
    expect(migrateLegacyPreference(alice, 'repository.prs.sort', legacy)).toBe('kept');
    expect(localStorage.getItem('legacy')).not.toBeNull();
    vi.restoreAllMocks();
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw Error('denied');
    });
    expect(migrateLegacyPreference(alice, 'repository.prs.sort', legacy)).toBe('kept');
  });
  it('neither deletes nor migrates a section the server read as valid', () => {
    seedPreferences(alice, { overview: 'saved' });
    localStorage.setItem('legacy', '"legacy"');
    const read = vi.fn(() => 'legacy');
    renderHook(() =>
      usePreferenceCookie(savedSection('overview', 'saved'), { keys: ['legacy'], read }),
    );
    expect(read).not.toHaveBeenCalled();
    expect(localStorage.getItem('legacy')).toBe('"legacy"');
    expect(preferenceSections('repositories')).toEqual({ overview: 'saved' });
  });
});
