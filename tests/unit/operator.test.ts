// @vitest-environment node
import { it, expect } from 'vitest';
import { mkdtemp, readFile, stat, rm, symlink } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { resolve } from 'node:path';
import { spawnSync } from 'node:child_process';
import { parseOperatorCommand, writeCredentialFile } from '../../scripts/auth-operator';
const target = [
  '--region',
  'us-east-2',
  '--users-table',
  'users',
  '--whitelist-table',
  'whitelist',
];
it('requires explicit targets and separates bootstrap, recovery, access, and dry-run migration', () => {
  expect(parseOperatorCommand(['migrate', ...target])).toMatchObject({
    command: 'migrate',
    apply: false,
  });
  expect(parseOperatorCommand(['migrate', ...target, '--apply'])).toMatchObject({ apply: true });
  expect(
    parseOperatorCommand([
      'bootstrap',
      ...target,
      '--email',
      'Admin@example.test',
      '--output',
      'first.credentials.json',
    ]),
  ).toMatchObject({ email: 'admin@example.test' });
  expect(() => parseOperatorCommand(['bootstrap', '--email', 'admin@example.test'])).toThrow();
  expect(() =>
    parseOperatorCommand([
      'bootstrap',
      ...target,
      '--email',
      'admin@example.test',
      '--output',
      'file.json',
    ]),
  ).toThrow();
  expect(() =>
    parseOperatorCommand([
      'bootstrap',
      ...target,
      '--email',
      'admin@example.test',
      '--output',
      'first.credentials.json',
      '--role',
      'viewer',
    ]),
  ).toThrow();
  expect(() =>
    parseOperatorCommand(['set-access', ...target, '--email', 'a@example.test', '--role', 'admin']),
  ).toThrow();
  expect(() => parseOperatorCommand(['migrate', 'another', ...target])).toThrow();
});
it('writes credentials privately and never overwrites or follows an existing file', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'operator-file-'));
  try {
    const path = join(directory, 'one.credentials.json');
    await writeCredentialFile(path, { temporaryPassword: 'synthetic-only' });
    expect((await stat(path)).mode & 0o777).toBe(0o600);
    const original = await readFile(path, 'utf8');
    await expect(
      writeCredentialFile(path, { temporaryPassword: 'replacement' }),
    ).rejects.toMatchObject({ code: 'EEXIST' });
    expect(await readFile(path, 'utf8')).toBe(original);
    const linked = join(directory, 'link.credentials.json');
    await symlink(path, linked);
    await expect(
      writeCredentialFile(linked, { temporaryPassword: 'replacement' }),
    ).rejects.toThrow();
    expect(await readFile(path, 'utf8')).toBe(original);
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});
it('keeps public setup endpoints closed without account reads', async () => {
  const { POST } = await import('@/app/api/auth/setup/route');
  const { GET } = await import('@/app/api/auth/setup/check/route');
  expect(POST().status).toBe(403);
  expect(GET().status).toBe(403);
});
it('runs the documented CLI and does not print rejected secret-like arguments', () => {
  const args = [
    '--conditions=react-server',
    '--import',
    'tsx',
    resolve('scripts/auth-operator.ts'),
  ];
  const help = spawnSync(process.execPath, [...args, '--help'], { encoding: 'utf8' });
  expect(help.status).toBe(0);
  expect(help.stdout).toContain('inspect');
  const failure = spawnSync(
    process.execPath,
    [...args, 'bootstrap', '--password', 'private-canary-argument'],
    { encoding: 'utf8' },
  );
  expect(failure.status).toBe(1);
  expect(failure.stderr).toContain('Operator command failed');
  expect(failure.stdout + failure.stderr).not.toContain('private-canary-argument');
});
