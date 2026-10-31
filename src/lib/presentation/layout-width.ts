export const layoutWidthCookie = 'dashboard-layout-width';
export type LayoutWidth = 'wide' | 'contained';

/** Unknown or missing values fall back to the full-width default. */
export function parseLayoutWidth(value: string | undefined): LayoutWidth {
  return value === 'contained' ? 'contained' : 'wide';
}

/** A year-long, site-wide cookie; `Secure` is only valid on HTTPS origins. */
export function layoutWidthCookieString(width: LayoutWidth, secure: boolean) {
  return (
    `${layoutWidthCookie}=${width}; Path=/; Max-Age=31536000; SameSite=Lax` +
    (secure ? '; Secure' : '')
  );
}
