export type MutationDecision =
  { allowed: true } | { allowed: false; status: 403 | 415 | 503; error: string };
export function accountMutationPolicy(
  headers: Headers,
  configuredOrigin: string | undefined,
): MutationDecision {
  if (!configuredOrigin)
    return { allowed: false, status: 503, error: 'Account mutation origin is not configured.' };
  const origin = new URL(configuredOrigin).origin;
  if (headers.get('origin') !== origin)
    return { allowed: false, status: 403, error: 'A same-origin request is required.' };
  if (headers.get('content-type')?.split(';', 1)[0].trim().toLowerCase() !== 'application/json')
    return { allowed: false, status: 415, error: 'Content-Type must be application/json.' };
  return { allowed: true };
}
