import { additionalMetricIds } from '@/models/contribution-activity';
import type { ContributionSource } from '@/models/contributions';
/** Explicitly unavailable optional data for hand-authored fixtures that exercise only core credits. */
export function unpreparedActivity(): ContributionSource['activity'] {
  return {
    comments: [],
    volumes: [],
    coverage: Object.fromEntries(
      additionalMetricIds.map((metric) => [
        metric,
        {
          status: 'missing',
          reason: 'Optional activity is not prepared in this core-credit fixture.',
        },
      ]),
    ) as ContributionSource['activity']['coverage'],
  };
}
