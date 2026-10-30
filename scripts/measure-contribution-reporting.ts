import { performance } from 'node:perf_hooks';
import { contributionSample } from '../src/mocks/contributions';
import { validateContributionSource } from '../src/lib/presentation/contribution-source';
import { selectContributions } from '../src/lib/presentation/contributions';
// Diagnostic measurements, not a hardware-dependent CI timing assertion.
for (const extra of [0, 1000, 3000]) {
  const input = structuredClone(contributionSample({ scenario: 'large' }));
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
