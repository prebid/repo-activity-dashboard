import {
  defaultContributionSelection,
  selectContributionPresentation,
} from '@/lib/presentation/contributions';
import type {
  ContributionSource,
  ContributionMetric,
  ContributionSelection,
  ContributionFocus,
} from '@/models/contributions';
/** Existing credit assertions exercise the same composition used by the actual detail pages. */
export function selectContributionDetails(
  source: ContributionSource,
  metric: ContributionMetric,
  selection?: ContributionSelection,
  focus: ContributionFocus = { kind: 'overview' },
) {
  const result = selectContributionPresentation(
    source,
    selection ?? defaultContributionSelection(source),
    focus,
    metric,
  );
  if (!result.details) throw Error('Expected supporting details');
  return result.details;
}
