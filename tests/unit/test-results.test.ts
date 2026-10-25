// @vitest-environment node
import { it, expect } from 'vitest';
import { validateTestResults } from '../../scripts/check-test-results.mjs';
const unit = {
  success: true,
  numTotalTests: 1,
  numPassedTests: 1,
  numFailedTests: 0,
  numPendingTests: 0,
  numTodoTests: 0,
  numFailedTestSuites: 0,
  numPendingTestSuites: 0,
  testResults: [{ status: 'passed', assertionResults: [{ status: 'passed' }] }],
};
const browser = {
  stats: { expected: 1, unexpected: 0, skipped: 0, flaky: 0 },
  errors: [],
  suites: [
    {
      suites: [
        {
          specs: [
            {
              tests: [
                { status: 'expected', expectedStatus: 'passed', results: [{ status: 'passed' }] },
              ],
            },
          ],
        },
      ],
    },
  ],
};
it('requires individually passing nonempty unit and nested browser results', () => {
  expect(validateTestResults(unit, 'vitest')).toBe(1);
  expect(validateTestResults(browser, 'playwright')).toBe(1);
});
it.each([
  {},
  { ...unit, numTotalTests: 0, numPassedTests: 0, testResults: [] },
  { ...unit, numPendingTests: 1 },
  { ...unit, numTodoTests: 1 },
  { ...unit, numFailedTestSuites: 1 },
  { ...unit, numPassedTests: 2 },
  { ...unit, testResults: [{ status: 'passed', assertionResults: [{ status: 'failed' }] }] },
])('rejects an incomplete or inconsistent unit verdict %#', (input) => {
  expect(() => validateTestResults(input, 'vitest')).toThrow();
});
it.each([
  {},
  { ...browser, suites: [] },
  { ...browser, suites: [{ specs: [] }] },
  { ...browser, stats: { ...browser.stats, skipped: 1 } },
  { ...browser, stats: { ...browser.stats, flaky: 1 } },
  { ...browser, errors: [{ message: 'server failed' }] },
  {
    ...browser,
    suites: [
      {
        specs: [
          {
            tests: [
              { status: 'expected', expectedStatus: 'failed', results: [{ status: 'failed' }] },
            ],
          },
        ],
      },
    ],
  },
])('rejects an incomplete or falsely green browser verdict %#', (input) => {
  expect(() => validateTestResults(input, 'playwright')).toThrow();
});
