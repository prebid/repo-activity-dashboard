import { performance } from 'node:perf_hooks';
import { contributionSample } from '../src/mocks/contributions';
import { validateContributionSource } from '../src/lib/presentation/contribution-source';
import { selectContributions } from '../src/lib/presentation/contributions';
import { additionalMetricIds } from '../src/models/contribution-activity';
// Diagnostic measurements, not a hardware-dependent CI timing assertion.
for (const coverage of ['complete', 'core-gap', 'additional-gap', 'both-gaps'])
  for (const extra of [0, 1000, 3000]) {
    const input = structuredClone(contributionSample({ scenario: 'large' }));
    if (coverage === 'core-gap' || coverage === 'both-gaps')
      input.coverage.reviewerContributions = {
        status: 'partial',
        reason: 'Early history incomplete',
      };
    if (coverage === 'additional-gap' || coverage === 'both-gaps') {
      input.activity.comments = [];
      input.activity.volumes = [];
      for (const metric of additionalMetricIds)
        input.activity.coverage[metric] = {
          status: 'missing',
          reason: 'Optional data not collected',
        };
    }
    for (let i = 0; i < extra; i++)
      input.accounts.push({
        id: 'inactive-' + i,
        login: 'inactive-' + i,
        name: 'Inactive ' + i,
        companyId: null,
        actorType: 'human',
      });
    const start = performance.now(),
      source = validateContributionSource(input),
      validationMs = performance.now() - start;
    for (const area of ['contributors', 'companies'] as const) {
      const times: number[] = [];
      let bytes = 0;
      for (let i = 0; i < 4; i++) {
        const before = performance.now(),
          report = selectContributions(source, undefined, undefined, { area });
        times.push(performance.now() - before);
        bytes = Buffer.byteLength(JSON.stringify(report));
      }
      console.log(
        JSON.stringify({
          coverage,
          extraInactive: extra,
          area,
          validationMs: Number(validationMs.toFixed(2)),
          firstProjectionMs: Number(times[0].toFixed(2)),
          medianWarmMs: Number(
            times
              .slice(1)
              .sort((a, b) => a - b)[1]
              .toFixed(2),
          ),
          reportBytes: bytes,
        }),
      );
    }
  }
