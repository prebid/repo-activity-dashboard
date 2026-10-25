import { spawn } from 'node:child_process';
import { readFile, writeFile } from 'node:fs/promises';
import { parseArgs } from 'node:util';
import { writeRuntimeSettings } from './runtime-settings.mjs';
const [command, mode] = process.argv.slice(2);
if (!['dev', 'build', 'start'].includes(command) || !['preview', 'production'].includes(mode))
  throw new Error('Expected dev|build|start preview|production');
if (mode === 'preview' && process.env.AWS_APP_ID)
  throw new Error('Amplify must use the production build.');
if (command === 'start') {
  const builtMode = (await readFile('.next/dashboard-mode', 'utf8')).trim();
  if (builtMode !== mode) throw new Error('Start mode must match the build mode.');
}
/** @type {NodeJS.ProcessEnv} */
const environment = { ...process.env, DASHBOARD_BUILD_MODE: mode, NEXT_TELEMETRY_DISABLED: '1' };
if (command === 'build') {
  await writeRuntimeSettings(mode === 'production' ? process.env : {}, '.dashboard-runtime.json');
}
if (mode === 'preview') {
  const { values } = parseArgs({
    args: process.argv.slice(4),
    strict: false,
    options: { port: { type: 'string', short: 'p' }, hostname: { type: 'string', short: 'H' } },
  });
  const host = typeof values.hostname === 'string' ? values.hostname : 'localhost';
  const port = typeof values.port === 'string' ? values.port : process.env.PORT || '3000';
  const origin = new URL('http://' + (host.includes(':') ? '[' + host + ']' : host) + ':' + port)
    .origin;
  // Existing production .env settings must not redirect preview login to a live host.
  environment.AUTH_URL = origin;
  environment.NEXTAUTH_URL = origin;
}
const child = spawn(
  process.execPath,
  ['node_modules/next/dist/bin/next', command, ...process.argv.slice(4)],
  {
    stdio: 'inherit',
    env: environment,
  },
);
process.on('SIGTERM', () => child.kill('SIGTERM'));
process.on('SIGINT', () => child.kill('SIGINT'));
child.on('exit', (code) => {
  if (code !== 0) {
    process.exitCode = code ?? 1;
    return;
  }
  if (command === 'build') {
    void (async () => {
      await writeFile(
        '.next/server/dashboard-runtime.json',
        await readFile('.dashboard-runtime.json'),
        { mode: 0o600 },
      );
      await writeFile('.next/dashboard-mode', mode);
    })().catch((error) => {
      console.error('Unable to record build mode:', error);
      process.exitCode = 1;
    });
  }
});
