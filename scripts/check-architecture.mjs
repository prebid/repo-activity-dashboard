import { spawnSync } from 'node:child_process';
import { resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { z } from 'zod';
const repository = fileURLToPath(new URL('../', import.meta.url));
const resultSchema = z.object({
  modules: z.array(z.object({ source: z.string() })),
  summary: z.object({
    violations: z.array(
      z.object({ from: z.string(), to: z.string(), rule: z.object({ name: z.string() }) }),
    ),
  }),
});
/** @param {string} root */
export function inspectArchitecture(root) {
  const run = spawnSync(
    process.execPath,
    [
      resolve(repository, 'node_modules/dependency-cruiser/bin/dependency-cruiser.mjs'),
      '--config',
      resolve(repository, 'dependency-cruiser.config.mjs'),
      '--output-type',
      'json',
      'src',
    ],
    { cwd: root, encoding: 'utf8', maxBuffer: 16 * 1024 * 1024 },
  );
  if (run.error || run.signal || !run.stdout)
    throw new Error('Dependency scan failed: ' + (run.error?.message ?? run.stderr));
  const result = resultSchema.parse(JSON.parse(run.stdout));
  const sourceFiles = result.modules.filter(
    (module) => module.source.startsWith('src/') && /\.[cm]?[jt]sx?$/.test(module.source),
  ).length;
  const failures = result.summary.violations.map(
    (violation) => `${violation.rule.name}: ${violation.from} -> ${violation.to}`,
  );
  if (!sourceFiles) failures.push('No source files selected');
  if (run.status !== 0 && failures.length === 0)
    failures.push('Dependency scan exited without a complete result');
  return { root, sourceFiles, failures };
}
if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  const result = inspectArchitecture(process.cwd());
  console.log(JSON.stringify(result, null, 2));
  if (result.failures.length) process.exitCode = 1;
}
