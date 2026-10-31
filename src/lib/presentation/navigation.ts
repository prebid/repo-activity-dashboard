export function safeReturnPath(value: string | null | undefined): string {
  if (!value || !value.startsWith('/') || value.startsWith('//') || /[\\\\\r\n]/.test(value))
    return '/repos';
  try {
    const url = new URL(value, 'https://dashboard.invalid');
    if (url.origin !== 'https://dashboard.invalid') return '/repos';
    if (
      !['/repos', '/contributors', '/companies', '/foundation', '/admin/users'].some(
        (p) => url.pathname === p || url.pathname.startsWith(p + '/'),
      )
    )
      return '/repos';
    return url.pathname + url.search + url.hash;
  } catch {
    return '/repos';
  }
}
/** One spelling per route: equivalent percent-encodings of a segment compare equal. */
export function canonicalRoutePath(path: string): string {
  return path
    .split('/')
    .map((segment) => {
      try {
        return encodeURIComponent(decodeURIComponent(segment));
      } catch {
        return segment;
      }
    })
    .join('/');
}
/** Route params arrive percent-encoded; decode each segment once into its logical identity. */
export function decodeRouteSegment(segment: string): string | null {
  try {
    return decodeURIComponent(segment);
  } catch {
    return null;
  }
}
