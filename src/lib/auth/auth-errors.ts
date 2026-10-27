export class AuthStateError extends Error {
  constructor(
    public readonly kind: 'unavailable' | 'configuration' | 'integrity',
    options?: ErrorOptions,
    message?: string,
  ) {
    super(
      message ??
        (kind === 'unavailable'
          ? 'Authentication is temporarily unavailable. Please try again.'
          : 'Authentication requires operator attention.'),
      options,
    );
  }
}
