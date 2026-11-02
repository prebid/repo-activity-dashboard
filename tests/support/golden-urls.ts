// The golden URL set: the address bars and in-app links that every inventory view shows today,
// recorded by tests/e2e/golden-urls.spec.ts and resolved to page state by
// tests/unit/golden-urls.test.ts.

/** Links of one kind: one route pattern with one set of query keys. */
export interface GoldenLinkKind {
  /** Anchors of this kind on the view. */
  readonly count: number;
  /** The first anchor of this kind in document order. */
  readonly example: string;
  /** Characters in the longest href attribute of this kind. */
  readonly longest: number;
}

export interface GoldenView {
  /** The route pattern that serves the view. */
  readonly route: string;
  /** The inventory path, as requested. */
  readonly requested: string;
  /** Path and query in the address bar once the view has loaded. */
  readonly address: string;
  /**
   * Keyed by route pattern, then `?` and the sorted query keys joined by `&`, then `#` when the
   * href carries a fragment.
   */
  readonly links: Readonly<Record<string, GoldenLinkKind>>;
}

export interface GoldenUrls {
  readonly version: 1;
  /** The All repositories scope change that the Baseline measurements row names. */
  readonly scopeChange: {
    readonly change: string;
    readonly address: string;
    readonly length: number;
  };
  readonly views: Readonly<Record<string, GoldenView>>;
}

/** Splits a link-kind key into its route pattern, query keys and fragment flag. */
export function linkKindParts(kind: string): { route: string; keys: string[]; fragment: boolean } {
  const fragment = kind.endsWith('#');
  const [route, query] = (fragment ? kind.slice(0, -1) : kind).split('?', 2);
  return { route, keys: query ? query.split('&') : [], fragment };
}

/** JSON with object keys in code-unit order at every depth, so a snapshot diff shows only changes. */
export function stableJson(value: unknown): string {
  const sorted = (item: unknown): unknown =>
    Array.isArray(item)
      ? item.map(sorted)
      : item && typeof item === 'object'
        ? Object.fromEntries(
            Object.keys(item)
              .sort()
              .map((key) => [key, sorted((item as Record<string, unknown>)[key])]),
          )
        : item;
  return JSON.stringify(sorted(value), null, 2) + '\n';
}
