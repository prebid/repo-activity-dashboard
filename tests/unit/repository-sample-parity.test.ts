import { expect, it } from 'vitest';
import { createRepositoryTimelineProjection } from '@/lib/presentation/repository-timeline';
import { selectRepositoryPage } from '@/lib/presentation/repository-page';
import { repositoryInsightSample } from '@/mocks/repository-insights';
import { repositoryOverviewSamples } from '@/mocks/repository-overview';
import { repositoryPageSample } from '@/mocks/repository-page';
import { repositoryTimelineSample } from '@/mocks/repository-timeline';
import type { RepositoryTimelineActivityMetric } from '@/models/repository-timeline';

// Summary values, record-list measurements and the repository Timeline's whole-range summary
// describe the same records, so for one repository, range and metric they must agree exactly.
const samples = repositoryOverviewSamples();
const sources = new Map(
  samples.repositories.flatMap(({ repository }) =>
    (['prs', 'issues'] as const).map((kind) => [
      repository.id + ':' + kind,
      repositoryTimelineSample(kind, repository.id),
    ]),
  ),
);
const recordMetrics = ['prsOpened', 'prsMerged', 'issuesOpened', 'issuesClosed'] as const;

it.each(samples.periods.map(({ period }) => [period.range.start, period]))(
  'agrees across Summary, record lists and the Timeline for the period from %s',
  (_, period) => {
    const projection = createRepositoryTimelineProjection(
      { range: period.range, grouping: 'month' },
      samples.asOf,
    );
    const entry = samples.periods.find((item) => item.period === period)!;
    for (const { repository } of samples.repositories) {
      const summary = entry.rows[repository.id].activity;
      const timeline = {
        ...projection.select(sources.get(repository.id + ':prs')!).summary,
        ...projection.select(sources.get(repository.id + ':issues')!).summary,
      };
      const at = (metric: RepositoryTimelineActivityMetric) => repository.slug + '/' + metric;
      for (const metric of recordMetrics) {
        const list = selectRepositoryPage(
          repositoryPageSample(repository, {
            selection: {
              scope: 'period',
              metric,
              range: period.range,
              ...(metric === 'prsMerged' ? { branch: repository.primaryBranch } : {}),
            },
            returnTo: '/repos',
          }),
        );
        expect(list.measurement, at(metric)).toEqual(summary.counts[metric]);
        expect(timeline[metric], at(metric)).toEqual(list.measurement);
      }
      for (const metric of ['prAuthors', 'issueAuthors'] as const) {
        const authors = repositoryInsightSample(repository, {
          selection: { scope: 'period', metric, range: period.range },
          returnTo: '/repos',
        });
        expect(authors.measurement, at(metric)).toEqual(summary.counts[metric]);
        expect(timeline[metric], at(metric)).toEqual(authors.measurement);
      }
      const duration = repositoryInsightSample(repository, {
        selection: {
          scope: 'period',
          metric: 'medianMergeDays',
          range: period.range,
          branch: repository.primaryBranch,
        },
        returnTo: '/repos',
      });
      if (duration.kind !== 'duration') throw new Error('Expected duration');
      expect(duration.days, at('medianMergeDays')).toEqual(summary.mergeDuration.days);
      expect(timeline.medianMergeDays, at('medianMergeDays')).toEqual(duration.days);
    }
  },
);
