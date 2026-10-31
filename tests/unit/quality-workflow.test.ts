// @vitest-environment node
import { readFileSync } from 'node:fs';
import { expect, it } from 'vitest';

const { scripts } = JSON.parse(readFileSync('package.json', 'utf8')) as {
  scripts: Record<string, string>;
};
const workflow = readFileSync('.github/workflows/quality.yml', 'utf8');

/** CI runs each `check:all` step as a single-line `npm run` step, except test:e2e, which is sharded. */
function ciDivergence(checkAll: string, e2e: string, source: string) {
  const problems: string[] = [];
  const required = checkAll.split(' && ').flatMap((part) => {
    const name = /^npm run ([\w:-]+)$/.exec(part)?.[1];
    if (!name) problems.push('Unsupported check:all step: ' + part);
    return name && name !== 'test:e2e' ? [name] : [];
  });
  const steps = [...source.matchAll(/^ {6}- run: npm run ([\w:-]+)$/gm)].map((match) => match[1]);
  for (const name of required) if (!steps.includes(name)) problems.push('CI does not run ' + name);
  for (const name of new Set(steps)) {
    if (!required.includes(name)) problems.push('CI runs ' + name + ' outside check:all');
    if (steps.indexOf(name) !== steps.lastIndexOf(name))
      problems.push('CI runs ' + name + ' twice');
  }
  const [clear, run, verify, ...extra] = e2e.split(' && ');
  const sharded = [
    clear,
    'npx --no-install ' + run + ' --project="$BROWSER_PROJECT" --shard="$SHARD_INDEX/$SHARD_TOTAL"',
    verify,
  ].map((command) => ' '.repeat(10) + command);
  if (
    !checkAll.split(' && ').includes('npm run test:e2e') ||
    run !== 'playwright test' ||
    extra.length > 0 ||
    !source.includes(sharded.join('\n') + '\n')
  )
    problems.push('CI browser job does not match test:e2e');
  return problems;
}

it('runs every check:all step in CI, with test:e2e split into browser shards', () => {
  expect(ciDivergence(scripts['check:all'], scripts['test:e2e'], workflow)).toEqual([]);
});
it('reports check:all and test:e2e changes that CI does not follow', () => {
  expect(
    ciDivergence(scripts['check:all'] + ' && npm run test:new', scripts['test:e2e'], workflow),
  ).toEqual(['CI does not run test:new']);
  expect(
    ciDivergence(
      scripts['check:all'].replace('npm run build:storybook && ', ''),
      scripts['test:e2e'],
      workflow,
    ),
  ).toEqual(['CI runs build:storybook outside check:all']);
  expect(
    ciDivergence(scripts['check:all'] + ' && node scripts/new.mjs', scripts['test:e2e'], workflow),
  ).toEqual(['Unsupported check:all step: node scripts/new.mjs']);
  expect(
    ciDivergence(scripts['check:all'], scripts['test:e2e'] + ' && npm run report', workflow),
  ).toEqual(['CI browser job does not match test:e2e']);
  expect(
    ciDivergence(
      scripts['check:all'],
      scripts['test:e2e'].replace('playwright test', 'playwright test --grep @fast'),
      workflow,
    ),
  ).toEqual(['CI browser job does not match test:e2e']);
});
