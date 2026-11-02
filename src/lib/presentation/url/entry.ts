// Saved values on entries (decisions C1 and C2). Pure: the caller reads and validates the cookie.
import { withoutDefaults } from './codec';
import {
  paramFor,
  routeArea,
  routeKinds,
  screenOf,
  type UrlRoute,
  type UrlValue,
  type UrlValues,
} from './registry';

/** A viewer's validated saved sections for one screen, already in registry values. */
export interface SavedViewValues {
  /** Report scope (period, repositories, population). Applies on list routes only. */
  readonly scope?: UrlValues;
  /** Table and chart presentation (sort, columns, grouping, charts). */
  readonly presentation?: UrlValues;
}

/**
 * The values an entry renders: its selectors and return context, then the saved sections C2 allows
 * on its route. List routes take saved scope and presentation; detail routes take presentation only,
 * so a contributor or company page never inherits the shared contribution scope. Saved values the
 * entry's screen does not accept are left out, and saved values never replace a selector.
 */
export function entryValues(route: UrlRoute, entry: UrlValues, saved: SavedViewValues): UrlValues {
  const screen = screenOf(route, entry);
  const result: Record<string, UrlValue> = { ...entry };
  const sections = [
    ...(routeKinds[route] === 'list' ? [saved.scope ?? {}] : []),
    saved.presentation ?? {},
  ];
  for (const section of sections)
    for (const [name, value] of Object.entries(section)) {
      const domain = paramFor(route, screen, name)?.domain;
      if (
        domain === undefined ||
        domain === 'selector' ||
        domain === 'return' ||
        domain === 'version' ||
        name in entry
      )
        continue;
      result[name] = value;
    }
  return withoutDefaults(route, result);
}
/** Whether saved scope may apply on a route (C2): never on detail routes of either area. */
export function appliesSavedScope(route: UrlRoute): boolean {
  return routeKinds[route] === 'list';
}
/** The preference cookie an entry reads. */
export function entryCookie(route: UrlRoute): 'repositories' | 'contributions' {
  return routeArea(route);
}
