const codes = new Set([
  'EACCES',
  'ENOENT',
  'ZodError',
  'SyntaxError',
  'AccessDeniedException',
  'ResourceNotFoundException',
  'TransactionCanceledException',
  'TimeoutError',
  'AbortError',
  'CredentialsProviderError',
  'CallbackRouteError',
  'CredentialsSignin',
  'MissingCSRF',
  'JWTSessionError',
  'exists',
  'not-found',
  'conflict',
  'integrity',
  'bootstrap-complete',
  'expired',
]);
// Prefer the deepest recognized cause; never serialize messages, requests or failed records.
export function safeErrorCode(error: unknown): string {
  let current = error;
  let code = 'Unknown';
  for (let depth = 0; depth < 8 && current && typeof current === 'object'; depth++) {
    const node = current as Record<string, unknown>;
    const candidate = [node.code, node.name, node.type].find(
      (value): value is string => typeof value === 'string' && codes.has(value),
    );
    if (candidate) code = candidate;
    current = node.cause ?? node.err;
  }
  return code;
}
