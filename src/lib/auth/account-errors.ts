export class AccountError extends Error {
  constructor(
    public readonly code:
      'exists' | 'not-found' | 'conflict' | 'integrity' | 'bootstrap-complete' | 'expired',
  ) {
    super(
      {
        exists: 'User already exists',
        'not-found': 'User not found',
        conflict: 'Account state changed. Refresh and try again.',
        integrity: 'Account state requires operator attention.',
        expired: 'Temporary password expired. Ask an administrator to reissue it.',
        'bootstrap-complete': 'Initial account setup has already been completed.',
      }[code],
    );
  }
}

export interface RecordProblem {
  table: 'users' | 'whitelist';
  key: string;
  fields: string[];
}
export class AccountDataError extends AccountError {
  constructor(public readonly records: RecordProblem[]) {
    super('integrity');
  }
}
export class MigrationInterruptedError extends AccountError {
  constructor(
    public readonly completed: string[],
    public readonly pending: string[],
    cause: unknown,
  ) {
    super('conflict');
    this.cause = cause;
  }
}
