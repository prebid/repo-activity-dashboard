// The report URL cap and its messages. Return context travels as `back` frames (url/back.ts); the
// old base64 trail is only read, by the legacy decoder (url/legacy/trail.ts).
export const contributionUrlLimit = 7500;
export const contributionLinkLimitMessage =
  'This selection is too large for a detail link. Narrow the filters or search and try again.';
export const contributionChangeLimitMessage =
  'This change is too large for the report URL. Reduce the selection and try again.';
export function contributionUrlFits(href: string): boolean {
  return new TextEncoder().encode(href).length <= contributionUrlLimit;
}
