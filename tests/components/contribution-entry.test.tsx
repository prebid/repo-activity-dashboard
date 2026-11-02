import { act, renderHook } from '@testing-library/react';
import { renderToString } from 'react-dom/server';
import type { ReactNode } from 'react';
import { expect, it, vi } from 'vitest';
import { useContributionEntry } from '@/lib/navigation/use-contribution-entry';
import {
  PreferenceBindingProvider,
  usePreferenceBinding,
} from '@/lib/navigation/preference-binding';
import { writePreference } from '@/lib/navigation/use-preference-cookie';
import {
  defaultContributionSettings,
  serializeContributionPreferences,
} from '@/lib/presentation/contribution-settings';
import type { ContributionSettings } from '@/models/contribution-settings';
import type { PreferenceBinding } from '@/models/preferences';
import { contributionSample } from '@/mocks/contributions';
import { alice, seedPreferences } from '../support/preference-cookies';

const directory = contributionSample();
const settings = defaultContributionSettings(directory);
function saved(change: (value: ContributionSettings) => void) {
  const value = structuredClone(settings);
  change(value);
  return JSON.parse(serializeContributionPreferences(value)) as unknown;
}
function session(binding: PreferenceBinding | null) {
  return function Session({ children }: { children: ReactNode }) {
    return binding ? (
      <PreferenceBindingProvider binding={binding}>{children}</PreferenceBindingProvider>
    ) : (
      children
    );
  };
}
function entry(
  viewerId: string | undefined = 'alice',
  binding: PreferenceBinding | null = alice,
  repositories = directory.repositories,
) {
  return renderHook(() => useContributionEntry(viewerId, repositories), {
    wrapper: session(binding),
  });
}
const query = (href: string) => new URL(href, 'https://dashboard.test').searchParams;

it('gives the session binding inside the dashboard frame and none outside it', () => {
  expect(renderHook(() => usePreferenceBinding()).result.current).toBeNull();
  expect(
    renderHook(() => usePreferenceBinding(), { wrapper: session(alice) }).result.current,
  ).toEqual(alice);
});

it('renders an ordinary server link and resolves a saved scope before client navigation', () => {
  seedPreferences(alice, {
    'contributions.scope': saved(
      (value) => (value.period = { kind: 'preset', preset: 'last-month' }),
    ),
  });
  function Entry() {
    return <a href={useContributionEntry('alice', directory.repositories)}>Contributions</a>;
  }
  expect(
    renderToString(
      <PreferenceBindingProvider binding={alice}>
        <Entry />
      </PreferenceBindingProvider>,
    ),
  ).toContain('href="/contributors"');
  const { result } = entry();
  expect(query(result.current).get('period')).toBe('last-month');
  // A saved change anywhere on the page updates the link.
  act(() => {
    writePreference(
      alice,
      'contributions.scope',
      saved((value) => (value.selection.actorTypes = ['bot'])),
    );
  });
  expect(query(result.current).getAll('type')).toEqual(['bot']);
  act(() => {
    writePreference(alice, 'contributions.scope', null);
  });
  expect(result.current).toBe('/contributors');
});

it('reads a scope another tab saved when this window regains focus or becomes visible', () => {
  seedPreferences(alice, {
    'contributions.scope': saved(
      (value) => (value.period = { kind: 'preset', preset: 'last-month' }),
    ),
  });
  const { result } = entry();
  expect(query(result.current).get('period')).toBe('last-month');
  // Another tab writes the cookie; this window receives no event for it.
  seedPreferences(alice, {
    'contributions.scope': saved(
      (value) => (value.period = { kind: 'preset', preset: 'this-month' }),
    ),
  });
  act(() => {
    window.dispatchEvent(new FocusEvent('focus'));
  });
  expect(query(result.current).get('period')).toBe('this-month');
  seedPreferences(alice, {
    'contributions.scope': saved((value) => (value.selection.actorTypes = ['bot'])),
  });
  act(() => {
    document.dispatchEvent(new Event('visibilitychange'));
  });
  expect(query(result.current).getAll('type')).toEqual(['bot']);
});

it('ignores a scope saved for another account or authentication revision', () => {
  seedPreferences(alice, {
    'contributions.scope': saved(
      (value) => (value.period = { kind: 'preset', preset: 'last-month' }),
    ),
  });
  expect(entry('alice', { ...alice, authVersion: 1 }).result.current).toBe('/contributors');
  expect(entry('bob', { accountId: 'bob', authVersion: 0 }).result.current).toBe('/contributors');
  // The binding must name the signed-in viewer, and a page outside the frame has none.
  expect(entry('bob', alice).result.current).toBe('/contributors');
  expect(entry('alice', null).result.current).toBe('/contributors');
  const signedOut = renderHook(() => useContributionEntry(undefined, directory.repositories), {
    wrapper: session(alice),
  });
  expect(signedOut.result.current).toBe('/contributors');
});

it('uses the bare entry when the cookie is malformed or unreadable', () => {
  window.document.cookie = 'dashboard-contributions=not-a-document; Path=/';
  expect(entry().result.current).toBe('/contributors');
  seedPreferences(alice, { 'contributions.scope': { version: 1, settings: 'invalid' } });
  expect(entry().result.current).toBe('/contributors');
  seedPreferences(alice, {
    'contributions.scope': saved(
      (value) => (value.period = { kind: 'preset', preset: 'last-month' }),
    ),
  });
  vi.spyOn(Document.prototype, 'cookie', 'get').mockImplementation(() => {
    throw new DOMException('Cookies are blocked', 'SecurityError');
  });
  expect(entry().result.current).toBe('/contributors');
});

it.each(['repository', 'account', 'company', 'custom'] as const)(
  'leaves a saved %s scope to the server, which validates it',
  (kind) => {
    seedPreferences(alice, {
      'contributions.scope': saved((value) => {
        if (kind === 'repository')
          value.selection.repositoryIds = ['repo-prebidjs', 'repo-retired'];
        if (kind === 'account') value.selection.excludedAccountIds = ['account-alice'];
        if (kind === 'company')
          value.selection.population = {
            kind: 'selected',
            accountIds: [],
            companyIds: ['company-acme'],
          };
        if (kind === 'custom')
          value.period = { kind: 'custom', from: '2027-01-01', through: '2027-01-02' };
      }),
    });
    expect(entry().result.current).toBe('/contributors');
  },
);

it('keeps an explicit empty saved population empty in its entry link', () => {
  seedPreferences(alice, {
    'contributions.scope': saved((value) => {
      value.selection.repositoryIds = [];
      value.selection.population = { kind: 'selected', accountIds: [], companyIds: [] };
    }),
  });
  const params = query(entry().result.current);
  expect(params.get('repo')).toBe('');
  expect(params.get('population')).toBe('selected');
});

it('uses only enabled repositories supplied by the header', () => {
  seedPreferences(alice, {
    'contributions.scope': saved((value) => (value.selection.repositoryIds = ['repo-prebidjs'])),
  });
  expect(
    entry(
      'alice',
      alice,
      directory.repositories.filter((repo) => repo.id !== 'repo-prebidjs'),
    ).result.current,
  ).toBe('/contributors');
});
