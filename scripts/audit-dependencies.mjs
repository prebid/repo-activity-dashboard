import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { z } from 'zod';

// GHSA-g3hv-75wg-m249's amplification optimizer does not exist in minimatch 3.1.5.
// Keep this disposition bound to the reviewed development-only package and source.
const exception = {
  url: 'https://github.com/advisories/GHSA-g3hv-75wg-m249',
  version: '3.1.5',
  integrity:
    'sha512-VgjWUsnnT6n+NUk6eZq77zeFdpW2LWDzP6zFGrCbHXiYNul5Dzqk2HHQ5uFH2DNW5Xbp8+jVzaeNt94ssEEl4w==',
  sourceHash: '746849f267c4868a53729225bd85c7dccd387712136fb305fcc0a3eadd4a3d9d',
};
const severity = z.enum(['info', 'low', 'moderate', 'high', 'critical']);
const advisory = z.object({
  name: z.string().min(1),
  dependency: z.string().min(1),
  url: z.url(),
  severity,
  range: z.string().min(1),
});
const vulnerability = z.object({
  name: z.string().min(1),
  severity,
  via: z.array(z.union([z.string().min(1), advisory])).min(1),
  nodes: z.array(z.string().min(1)).min(1),
});
const reportSchema = z.object({
  auditReportVersion: z.literal(2),
  vulnerabilities: z.record(z.string(), vulnerability),
  metadata: z.object({
    vulnerabilities: z.object({ total: z.number().int().nonnegative() }),
    dependencies: z.object({ total: z.number().int().positive() }),
  }),
});
const lockedPackage = z.object({
  version: z.literal(exception.version),
  integrity: z.literal(exception.integrity),
  dev: z.literal(true),
});
const installedPackage = z.object({
  name: z.literal('minimatch'),
  version: z.literal(exception.version),
  main: z.literal('minimatch.js'),
  sourceHash: z.literal(exception.sourceHash),
});

/**
 * Inspect every concrete advisory, including those inherited through npm's dependency graph.
 * @param {string} output
 * @param {number | null} exitCode
 * @param {unknown} lockfile
 * @param {(node: string) => unknown} readInstalled
 */
export function inspectDependencyAudit(output, exitCode, lockfile, readInstalled) {
  if (exitCode !== 0 && exitCode !== 1) throw Error('npm audit did not complete successfully.');
  /** @type {unknown} */
  const raw = JSON.parse(output);
  if (typeof raw === 'object' && raw !== null && 'error' in raw) {
    const failure =
      /** @type {{ statusCode?: unknown, error?: { code?: unknown, summary?: unknown } }} */ (raw);
    throw Error(
      [
        'npm audit returned an error',
        failure.statusCode,
        failure.error?.code,
        failure.error?.summary,
      ]
        .filter((part) => part !== undefined && part !== null && part !== '')
        .join(': ') + '.',
    );
  }
  const report = reportSchema.parse(raw);
  const packages = z
    .object({ lockfileVersion: z.literal(3), packages: z.record(z.string(), z.unknown()) })
    .parse(lockfile).packages;
  const entries = Object.entries(report.vulnerabilities);
  if (
    entries.length !== report.metadata.vulnerabilities.total ||
    (entries.length === 0 ? exitCode !== 0 : exitCode !== 1)
  )
    throw Error('npm audit counts or exit status are inconsistent.');
  /** @type {Set<string>} */
  const accepted = new Set();
  /** @type {Set<string>} */
  const blocking = new Set();
  for (const [name, entry] of entries) {
    if (entry.name !== name) throw Error('npm audit package identity is inconsistent.');
    if (entry.severity !== 'moderate')
      blocking.add(name + ': unreviewed ' + entry.severity + ' severity');
    // npm can report cycles among meta-vulnerabilities. Each must reach a concrete advisory.
    const queue = [name],
      visited = new Set();
    let concrete = false;
    while (queue.length) {
      const next = queue.pop();
      if (visited.has(next)) continue;
      visited.add(next);
      const current = next === undefined ? undefined : report.vulnerabilities[next];
      if (!current) throw Error('npm audit references a missing dependency.');
      for (const via of current.via) {
        if (typeof via === 'string') {
          queue.push(via);
          continue;
        }
        concrete = true;
        const key = current.name + ': ' + via.url;
        const eligible =
          current.name === 'minimatch' &&
          current.severity === 'moderate' &&
          via.name === 'minimatch' &&
          via.dependency === 'minimatch' &&
          via.url === exception.url &&
          via.severity === 'moderate' &&
          via.range === '<11.0.1' &&
          current.nodes.every((node) => {
            if (
              !node.startsWith('node_modules/') ||
              node.split('/').some((part) => part === '..' || part === '.') ||
              !lockedPackage.safeParse(packages[node]).success
            )
              return false;
            return installedPackage.safeParse(readInstalled(node)).success;
          });
        (eligible ? accepted : blocking).add(key);
      }
    }
    if (!concrete) throw Error('npm audit contains a dependency cycle without advisory evidence.');
  }
  return {
    reportedPackages: entries.length,
    auditedDependencies: report.metadata.dependencies.total,
    accepted: [...accepted].sort(),
    blocking: [...blocking].sort(),
  };
}

// import.meta.main also holds when the script is reached through a symlinked path.
/** `info` keeps npm's exit status consistent with every reported entry, including info-only ones. */
export const npmAuditArguments = ['audit', '--json', '--audit-level=info', '--include=dev'];
if (import.meta.main) {
  /** @type {import('node:child_process').SpawnSyncReturns<string> | undefined} */
  let result;
  try {
    result = spawnSync('npm', npmAuditArguments, {
      encoding: 'utf8',
      maxBuffer: 8 * 1024 * 1024,
    });
    if (result.error) throw result.error;
    const outcome = inspectDependencyAudit(
      result.stdout,
      result.status,
      JSON.parse(readFileSync('package-lock.json', 'utf8')),
      (node) => ({
        ...JSON.parse(readFileSync(resolve(node, 'package.json'), 'utf8')),
        sourceHash: createHash('sha256')
          .update(readFileSync(resolve(node, 'minimatch.js')))
          .digest('hex'),
      }),
    );
    console.log(JSON.stringify(outcome, null, 2));
    if (outcome.accepted.length)
      console.log(
        'Scoped minimatch 3.1.5 non-applicability exception: docs/implementation/dependency-audit.md',
      );
    if (outcome.blocking.length) process.exitCode = 1;
  } catch (error) {
    console.error(error instanceof Error ? error.message : error);
    if (result?.stderr) console.error(result.stderr.trim());
    process.exitCode = 1;
  }
}
