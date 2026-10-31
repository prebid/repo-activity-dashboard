import {
  repositoryTimelineMatrixSample,
  repositoryTimelineSample,
  type RepositoryTimelineScenario,
} from '@/mocks/repository-timeline';
import type { RepositoryTimelineSource } from '@/models/repository-timeline';
import type { RepositoryTimelineMatrixSource } from '@/models/repository-timeline-matrix';
import { onlyCast } from './cast-source';

export function castTimelineSample(
  kind: 'prs' | 'issues' = 'prs',
  repositoryId = 'repo-prebidjs',
  scenario: RepositoryTimelineScenario = 'reference',
  gap = false,
): RepositoryTimelineSource {
  return onlyCast(
    repositoryTimelineSample(
      kind,
      repositoryId,
      scenario === 'calendar' ? 'reference' : scenario,
      gap,
    ),
    scenario,
    gap,
  );
}
export function castTimelineMatrixSample(
  kind: 'prs' | 'issues' | 'mixed' = 'prs',
  scenario: RepositoryTimelineScenario = 'reference',
  gap = false,
): RepositoryTimelineMatrixSource {
  const matrix = repositoryTimelineMatrixSample(
    kind,
    scenario === 'calendar' ? 'reference' : scenario,
    gap,
  );
  const repositories = matrix.repositories.map((source) => onlyCast(source, scenario, gap));
  return {
    ...matrix,
    scenarioId: repositories[0]?.scenarioId ?? matrix.scenarioId,
    repositories,
  };
}
