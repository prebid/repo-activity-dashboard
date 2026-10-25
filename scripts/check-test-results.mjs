import { readFileSync, rmSync } from 'node:fs';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { z } from 'zod';

const assertion = z.object({ status: z.literal('passed') });
const vitestReport = z.object({
  success: z.literal(true),
  numTotalTests: z.number().int().positive(),
  numPassedTests: z.number().int().positive(),
  numFailedTests: z.literal(0),
  numPendingTests: z.literal(0),
  numTodoTests: z.literal(0),
  numFailedTestSuites: z.literal(0),
  numPendingTestSuites: z.literal(0),
  testResults: z
    .array(z.object({ status: z.literal('passed'), assertionResults: z.array(assertion) }))
    .min(1),
});
const browserCase = z.object({
  expectedStatus: z.literal('passed'),
  status: z.literal('expected'),
  results: z.array(z.object({ status: z.literal('passed') })).min(1),
});
/** @type {z.ZodType<{ specs?: { tests: z.infer<typeof browserCase>[] }[], suites?: BrowserSuite[] }>} */
const browserSuite = z.lazy(() =>
  z.object({
    specs: z.array(z.object({ tests: z.array(browserCase).min(1) })).optional(),
    suites: z.array(browserSuite).optional(),
  }),
);
/** @typedef {z.infer<typeof browserSuite>} BrowserSuite */
const playwrightReport = z.object({
  stats: z.object({
    expected: z.number().int().positive(),
    unexpected: z.literal(0),
    skipped: z.literal(0),
    flaky: z.literal(0),
  }),
  errors: z.array(z.unknown()).length(0),
  suites: z.array(browserSuite).min(1),
});
/** @param {unknown} input @param {'vitest'|'playwright'} kind */
export function validateTestResults(input, kind) {
  if (kind === 'vitest') {
    const report = vitestReport.parse(input);
    const count = report.testResults.reduce(
      (total, suite) => total + suite.assertionResults.length,
      0,
    );
    if (count !== report.numTotalTests || count !== report.numPassedTests)
      throw new Error('Test counts do not match individual results');
    return count;
  }
  const report = playwrightReport.parse(input);
  /** @param {BrowserSuite} suite @returns {number} */
  function countSuite(suite) {
    return (
      (suite.specs ?? []).reduce((count, spec) => count + spec.tests.length, 0) +
      (suite.suites ?? []).reduce((count, child) => count + countSuite(child), 0)
    );
  }
  const count = report.suites.reduce((total, suite) => total + countSuite(suite), 0);
  if (count !== report.stats.expected)
    throw new Error('Browser counts do not match individual results');
  return count;
}
if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  const [kind, mode] = process.argv.slice(2);
  if (
    (kind !== 'vitest' && kind !== 'playwright' && kind !== 'accounts' && kind !== 'production') ||
    (mode !== undefined && mode !== '--clear')
  )
    throw new Error('Expected vitest|playwright [--clear]');
  const path = resolve('test-results', kind + '.json');
  if (mode === '--clear') rmSync(path, { force: true });
  else {
    const count = validateTestResults(
      JSON.parse(readFileSync(path, 'utf8')),
      kind === 'playwright' ? 'playwright' : 'vitest',
    );
    console.log(
      `${kind}: verified ${count} individually passing results; no skipped, pending, expected-failure, or flaky cases.`,
    );
  }
}
