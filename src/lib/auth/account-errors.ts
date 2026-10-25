export class AccountError extends Error {
  constructor(
    public readonly code: 'exists' | 'not-found' | 'conflict' | 'integrity' | 'bootstrap-complete',
  ) {
    super(
      {
        exists: 'User already exists',
        'not-found': 'User not found',
        conflict: 'Account state changed. Refresh and try again.',
        integrity: 'Account state requires operator attention.',
        'bootstrap-complete': 'Initial account setup has already been completed.',
      }[code],
    );
  }
}
