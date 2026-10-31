// @vitest-environment node
import { spawnSync } from 'node:child_process';
import { mkdtempSync, rmSync, symlinkSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { expect, it } from 'vitest';

it.each(['direct', 'symlinked'] as const)('runs a gate script through a %s path', (kind) => {
  const link = mkdtempSync(join(tmpdir(), 'gate-link-'));
  try {
    symlinkSync(resolve('scripts'), join(link, 'scripts'), 'dir');
    const script =
      kind === 'direct'
        ? resolve('scripts/check-test-results.mjs')
        : join(link, 'scripts/check-test-results.mjs');
    // An unknown suite name stops before any result file is read or cleared.
    const run = spawnSync(process.execPath, [script, 'unknown-suite'], { encoding: 'utf8' });
    expect(run.stderr).toContain('Expected vitest|playwright [--clear]');
    expect(run.status).toBe(1);
  } finally {
    rmSync(link, { recursive: true, force: true });
  }
});
