// @vitest-environment node
import { it, expect } from 'vitest';
import { mkdtemp, mkdir, writeFile, readFile, symlink, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { resolve, join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { spawnSync } from 'node:child_process';
import { z } from 'zod';

it('rejects an under-covered file even when its group average passes', async () => {
  const root = await mkdtemp(join(tmpdir(), 'dashboard-coverage-contract-'));
  try {
    await symlink(resolve('node_modules'), join(root, 'node_modules'), 'dir');
    await mkdir(join(root, 'src/lib/presentation'), { recursive: true });
    await writeFile(join(root, 'package.json'), '{"type":"module"}');
    await writeFile(
      join(root, 'src/lib/presentation/covered.ts'),
      Array.from(
        { length: 120 },
        (_, i) =>
          `export function f${i}(flag: boolean) {\n if(flag) return ${i};\n return ${i + 1};\n}`,
      ).join('\n'),
    );
    await writeFile(
      join(root, 'src/lib/presentation/partial.ts'),
      'export function partial(flag: boolean) {\n if (flag) return 1;\n return 2;\n}\n',
    );
    await writeFile(
      join(root, 'proof.test.ts'),
      `
import {it,expect} from 'vitest';
import * as covered from './src/lib/presentation/covered';
import {partial} from './src/lib/presentation/partial';
it('executes the selected population',()=>{for(const f of Object.values(covered)){f(true);f(false);}expect(partial(true)).toBe(1);});
`,
    );
    const configUrl = pathToFileURL(resolve('vitest.config.ts')).href;
    await writeFile(
      join(root, 'vitest.config.mjs'),
      `
import base from ${JSON.stringify(configUrl)};
const rule=base.test.coverage.thresholds['src/lib/presentation/**'];
export default {root: ${JSON.stringify(root)},test:{
 environment:'node',include:['proof.test.ts'],reporters:['json'],outputFile:'report.json',
 coverage:{provider:'v8',enabled:true,include:['src/lib/presentation/*.ts'],reporter:['json-summary'],
 thresholds:{'src/lib/presentation/**':process.env.COVERAGE_GROUP_CONTROL==='1'?{...rule,perFile:false}:rule}}
}};
`,
    );
    const run = (control: boolean) =>
      spawnSync(
        process.execPath,
        [
          resolve('node_modules/vitest/vitest.mjs'),
          'run',
          '--config',
          join(root, 'vitest.config.mjs'),
        ],
        {
          cwd: root,
          encoding: 'utf8',
          timeout: 30000,
          env: { ...process.env, COVERAGE_GROUP_CONTROL: control ? '1' : '0' },
        },
      );
    const group = run(true);
    expect(group.status, group.stdout + group.stderr).toBe(0);
    const perFile = run(false);
    expect(perFile.status, perFile.stdout + perFile.stderr).toBe(1);
    expect(perFile.stderr + perFile.stdout).toContain('partial.ts');
    const report = z.object({
      numTotalTests: z.literal(1),
      numPassedTests: z.literal(1),
      numFailedTests: z.literal(0),
      numPendingTests: z.literal(0),
    });
    report.parse(JSON.parse(await readFile(join(root, 'report.json'), 'utf8')));
    const coverage: unknown = JSON.parse(
      await readFile(join(root, 'coverage/coverage-summary.json'), 'utf8'),
    );
    expect(Object.keys(z.record(z.string(), z.unknown()).parse(coverage))).toHaveLength(3);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
}, 60000);
