// @vitest-environment node
import { describe, it, expect, afterEach } from 'vitest';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { spawnSync } from 'node:child_process';
const roots: string[] = [];
function run(
  args: string[],
  mode?: string,
  environment: Record<string, string> = {},
  captureEnvironment = false,
) {
  const root = mkdtempSync(join(tmpdir(), 'dashboard-mode-'));
  roots.push(root);
  if (mode) {
    mkdirSync(join(root, '.next'));
    writeFileSync(join(root, '.next/dashboard-mode'), mode);
  }
  if (captureEnvironment) {
    const directory = join(root, 'node_modules/next/dist/bin');
    mkdirSync(directory, { recursive: true });
    writeFileSync(
      join(directory, 'next'),
      'console.log(JSON.stringify({url:process.env.AUTH_URL,nextUrl:process.env.NEXTAUTH_URL,args:process.argv.slice(2)}));',
    );
  }
  return spawnSync(process.execPath, [resolve('scripts/app.mjs'), ...args], {
    cwd: root,
    encoding: 'utf8',
    env: { PATH: process.env.PATH, NODE_ENV: 'test', ...environment },
  });
}
afterEach(() => {
  for (const root of roots.splice(0)) rmSync(root, { recursive: true, force: true });
});
describe('application launcher boundaries', () => {
  it('invalidates the old build marker when a replacement build fails', () => {
    const root = mkdtempSync(join(tmpdir(), 'dashboard-failed-build-'));
    roots.push(root);
    mkdirSync(join(root, '.next'));
    writeFileSync(join(root, '.next/dashboard-mode'), 'production');
    mkdirSync(join(root, 'node_modules/next/dist/bin'), { recursive: true });
    writeFileSync(join(root, 'node_modules/next/dist/bin/next'), 'process.exit(2);');
    const result = spawnSync(
      process.execPath,
      [resolve('scripts/app.mjs'), 'build', 'production'],
      { cwd: root, encoding: 'utf8', env: { PATH: process.env.PATH, NODE_ENV: 'test' } },
    );
    expect(result.status).toBe(2);
    expect(existsSync(join(root, '.next/dashboard-mode'))).toBe(false);
  });
  it('keeps preview authentication on its local origin even with production URL settings', () => {
    const result = run(
      ['start', 'preview', '--hostname', '127.0.0.1', '--port', '3100'],
      'preview',
      { AUTH_URL: 'https://production.invalid', NEXTAUTH_URL: 'https://production.invalid' },
      true,
    );
    expect(result.status).toBe(0);
    expect(JSON.parse(result.stdout)).toEqual({
      url: 'http://127.0.0.1:3100',
      nextUrl: 'http://127.0.0.1:3100',
      args: ['start', '--hostname', '127.0.0.1', '--port', '3100'],
    });
  });
  it('rejects starting a production artifact as a preview', () => {
    const result = run(['start', 'preview'], 'production');
    expect(result.status).not.toBe(0);
    expect(result.stderr).toContain('Start mode must match');
  });
  it('rejects an Amplify preview before launching the app', () => {
    const result = run(['dev', 'preview'], undefined, { AWS_APP_ID: 'test-only' });
    expect(result.status).not.toBe(0);
    expect(result.stderr).toContain('Amplify must use the production build');
  });
  it('rejects unknown modes', () => {
    const result = run(['build', 'unknown']);
    expect(result.status).not.toBe(0);
    expect(result.stderr).toContain('Expected dev|build|start');
  });
});

it('binds an unspecified preview hostname to loopback', () => {
  const result = run(['start', 'preview'], 'preview', {}, true);
  expect(result.status).toBe(0);
  expect(JSON.parse(result.stdout)).toMatchObject({
    url: 'http://127.0.0.1:3000',
    args: ['start', '--hostname', '127.0.0.1'],
  });
});
