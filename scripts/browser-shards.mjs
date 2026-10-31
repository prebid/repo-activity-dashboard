import { execFileSync } from 'node:child_process';
import { mkdirSync, readFileSync, writeFileSync, appendFileSync, readdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { z } from 'zod';
import { validateTestResults } from './check-test-results.mjs';

const engine = z.enum(['chromium', 'webkit', 'firefox']);
const revision = z.string().regex(/^[a-f0-9]{40}$/);
/** @typedef {{title:string,specs?:{title:string,file:string,tests:{projectName:string,expectedStatus:'passed'}[]}[],suites?:Suite[]}} Suite */
/** @type {z.ZodType<Suite>} */
const suite = z.lazy(() =>
  z.object({
    title: z.string(),
    specs: z
      .array(
        z.object({
          title: z.string().min(1),
          file: z.string().min(1),
          tests: z
            .array(
              z.object({ projectName: z.string().min(1), expectedStatus: z.literal('passed') }),
            )
            .min(1),
        }),
      )
      .optional(),
    suites: z.array(suite).optional(),
  }),
);
const report = z.object({
  config: z.object({
    projects: z
      .array(
        z.object({
          name: z.string().min(1),
          metadata: z.object({ ciBrowser: engine.optional() }).passthrough().default({}),
        }),
      )
      .min(1),
    shard: z
      .object({ current: z.number().int().positive(), total: z.number().int().positive() })
      .nullable(),
  }),
  errors: z.array(z.unknown()).length(0),
  suites: z.array(suite).min(1),
});
const shard = z.object({
  id: z.string().regex(/^\d+-\d+$/),
  project: z.string().min(1),
  browser: engine,
  index: z.number().int().positive(),
  total: z.number().int().positive(),
  cases: z.array(z.string().min(1)).min(1),
});
const planSchema = z.object({
  version: z.literal(1),
  sourceRevision: revision,
  cases: z.array(z.string().min(1)).min(1),
  shards: z.array(shard).min(1).max(256),
});
/** @param {string[]} values @param {string} label */
function unique(values, label) {
  if (new Set(values).size !== values.length) throw Error('Duplicate ' + label);
  return values;
}
/** @param {string[]} actual @param {string[]} expected @param {string} label */
function sameCases(actual, expected, label) {
  unique(actual, label);
  const wanted = new Set(unique(expected, 'expected ' + label));
  if (actual.length !== wanted.size || actual.some((key) => !wanted.has(key)))
    throw Error('Incomplete or unexpected ' + label);
}
/** Native full and sharded JSON reports use the same file/title/project identity. @param {unknown} input */
export function browserInventory(input) {
  const parsed = report.parse(input);
  /** @type {{key:string,project:string}[]} */
  const cases = [];
  /** @param {Suite} item @param {string[]} path */
  function walk(item, path) {
    const titles = [...path, item.title];
    for (const spec of item.specs ?? [])
      for (const test of spec.tests)
        cases.push({
          project: test.projectName,
          key: JSON.stringify([test.projectName, spec.file, ...titles, spec.title]),
        });
    for (const child of item.suites ?? []) walk(child, titles);
  }
  for (const item of parsed.suites) walk(item, []);
  if (!cases.length) throw Error('No browser cases collected');
  unique(
    cases.map((item) => item.key),
    'browser case',
  );
  const projects = parsed.config.projects.map((p) => ({
    name: p.name,
    browser: engine.parse(p.metadata.ciBrowser ?? p.name),
  }));
  unique(
    projects.map((p) => p.name),
    'browser project',
  );
  if (cases.some((c) => !projects.some((p) => p.name === c.project)))
    throw Error('Unknown case project');
  return { cases, projects, shard: parsed.config.shard };
}
/** @param {unknown} inventory @param {number} total @param {string} sourceRevision @param {(project:string,index:number,total:number)=>unknown} collect */
export function createBrowserPlan(inventory, total, sourceRevision, collect) {
  z.number().int().min(1).max(256).parse(total);
  const full = browserInventory(inventory);
  if (full.shard) throw Error('Expected the unsharded full inventory');
  if (full.projects.length * total > 256) throw Error('Too many browser jobs');
  const shards = full.projects.flatMap((project, projectIndex) => {
    if (!full.cases.some((c) => c.project === project.name))
      throw Error('Project has no browser cases');
    return Array.from({ length: total }, (_, i) => {
      const part = browserInventory(collect(project.name, i + 1, total));
      if (
        part.shard?.current !== i + 1 ||
        part.shard.total !== total ||
        part.cases.some((c) => c.project !== project.name)
      )
        throw Error('Incorrect shard collection');
      return {
        id: `${projectIndex + 1}-${i + 1}`,
        project: project.name,
        browser: project.browser,
        index: i + 1,
        total,
        cases: part.cases.map((c) => c.key),
      };
    });
  });
  const cases = full.cases.map((c) => c.key);
  sameCases(
    shards.flatMap((s) => s.cases),
    cases,
    'shard partition',
  );
  return planSchema.parse({ version: 1, sourceRevision, cases, shards });
}
/** @param {unknown} input @param {{id:string,sourceRevision:string,report:unknown}[]} results @param {string} sourceRevision */
export function verifyBrowserShards(input, results, sourceRevision) {
  const plan = planSchema.parse(input);
  if (plan.sourceRevision !== revision.parse(sourceRevision))
    throw Error('Plan belongs to another source revision');
  unique(
    plan.shards.map((s) => s.id),
    'planned shard',
  );
  sameCases(
    plan.shards.flatMap((s) => s.cases),
    plan.cases,
    'planned case coverage',
  );
  sameCases(
    results.map((r) => r.id),
    plan.shards.map((s) => s.id),
    'shard reports',
  );
  for (const result of results) {
    const expected = plan.shards.find((s) => s.id === result.id);
    if (!expected || result.sourceRevision !== plan.sourceRevision)
      throw Error('Shard belongs to another source revision');
    validateTestResults(result.report, 'playwright');
    const actual = browserInventory(result.report);
    if (
      actual.shard?.current !== expected.index ||
      actual.shard.total !== expected.total ||
      actual.cases.some((c) => c.project !== expected.project)
    )
      throw Error('Shard identity does not match its plan');
    sameCases(
      actual.cases.map((c) => c.key),
      expected.cases,
      'shard case coverage',
    );
  }
  return plan.cases.length;
}

// import.meta.main also holds when the script is reached through a symlinked path.
if (import.meta.main) {
  const [mode, count] = process.argv.slice(2);
  const sourceRevision = execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim();
  mkdirSync('test-results', { recursive: true });
  if (mode === 'plan' && /^\d+$/.test(count ?? '')) {
    /** @param {string[]} extra @returns {unknown} */
    const collect = (extra) =>
      JSON.parse(
        execFileSync(
          'npx',
          ['--no-install', 'playwright', 'test', '--list', '--reporter=json', ...extra],
          { encoding: 'utf8', maxBuffer: 32 * 1024 * 1024 },
        ),
      );
    const plan = createBrowserPlan(
      collect([]),
      Number(count),
      sourceRevision,
      (project, index, total) => collect(['--project', project, '--shard', `${index}/${total}`]),
    );
    writeFileSync('test-results/browser-plan.json', JSON.stringify(plan, null, 2));
    const matrix = { include: plan.shards.map(({ cases: _cases, ...item }) => item) };
    if (process.env.GITHUB_OUTPUT)
      appendFileSync(process.env.GITHUB_OUTPUT, 'matrix=' + JSON.stringify(matrix) + '\n');
    console.log(
      JSON.stringify(
        {
          sourceRevision,
          totalCases: plan.cases.length,
          shards: plan.shards.map((s) => ({
            project: s.project,
            shard: `${s.index}/${s.total}`,
            cases: s.cases.length,
          })),
        },
        null,
        2,
      ),
    );
  } else if (mode === 'verify' && count === undefined) {
    const directory = 'test-results/shards';
    const results = readdirSync(directory, { withFileTypes: true }).map((entry) => {
      if (!entry.isDirectory() || !/^browser-report-\d+-\d+$/.test(entry.name))
        throw Error('Unexpected shard artifact');
      /** @type {unknown} */
      const data = JSON.parse(
        readFileSync(resolve(directory, entry.name, 'playwright.json'), 'utf8'),
      );
      return {
        id: entry.name.slice('browser-report-'.length),
        sourceRevision: readFileSync(
          resolve(directory, entry.name, 'source-revision'),
          'utf8',
        ).trim(),
        report: data,
      };
    });
    const verified = verifyBrowserShards(
      JSON.parse(readFileSync('test-results/browser-plan.json', 'utf8')),
      results,
      sourceRevision,
    );
    writeFileSync(
      'test-results/browser-verification.json',
      JSON.stringify(
        { sourceRevision, verifiedCases: verified, verifiedShards: results.length },
        null,
        2,
      ),
    );
    console.log(
      `Verified ${verified} distinct browser cases across ${results.length} complete shards; no skips, duplicates, omissions or source mismatch.`,
    );
  } else throw Error('Expected plan <shards-per-project> or verify');
}
