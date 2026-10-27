import { spawn, spawnSync } from 'node:child_process';
import { mkdir, readFile, mkdtemp, rm } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { createServer } from 'node:net';
import { tmpdir } from 'node:os';
import { resolve, join } from 'node:path';
import { setTimeout } from 'node:timers/promises';
import { DynamoDBClient, ListTablesCommand } from '@aws-sdk/client-dynamodb';
import type { TestProject } from 'vitest/node';
const digest = '7a94eb65f81aee270738751a4e5e3e6a7ad02a5d25194f55b83e08ec2ba6342b';
const url =
  'https://s3.us-west-2.amazonaws.com/dynamodb-local/v2.x/dynamodb_local_latest.tar.gz?versionId=.PDuh1xkiF7emxOWm0QfS9VSydd_NaRY';
export default async function setup(project: TestProject) {
  const cache = resolve('node_modules/.cache/dynamodb-local', digest);
  await mkdir(cache, { recursive: true });
  const archive = join(cache, 'dynamodb.tar.gz');
  try {
    await readFile(archive);
  } catch {
    const result = spawnSync(
      'curl',
      ['--fail', '--location', '--silent', '--show-error', '--output', archive, url],
      { encoding: 'utf8' },
    );
    if (result.status !== 0) throw new Error('DynamoDB Local download failed: ' + result.stderr);
  }
  if (
    createHash('sha256')
      .update(await readFile(archive))
      .digest('hex') !== digest
  )
    throw new Error(
      'DynamoDB Local checksum changed; review the upstream release before updating the pin.',
    );
  const unpacked = spawnSync('tar', ['-xzf', archive, '-C', cache], { encoding: 'utf8' });
  if (unpacked.status !== 0) throw new Error('Unable to unpack DynamoDB Local: ' + unpacked.stderr);
  const server = createServer();
  await new Promise<void>((resolve, reject) => {
    server.once('error', reject);
    server.listen(0, '127.0.0.1', resolve);
  });
  const address = server.address();
  if (!address || typeof address === 'string') throw new Error('No test port');
  const port = address.port;
  await new Promise<void>((resolve, reject) =>
    server.close((error) => (error ? reject(error) : resolve())),
  );
  const work = await mkdtemp(join(tmpdir(), 'dashboard-ddb-'));
  const child = spawn(
    'java',
    [
      '-Djava.library.path=' + join(cache, 'DynamoDBLocal_lib'),
      '-jar',
      join(cache, 'DynamoDBLocal.jar'),
      '-inMemory',
      '-sharedDb',
      '-port',
      String(port),
      '-disableTelemetry',
    ],
    { cwd: work, stdio: ['ignore', 'pipe', 'pipe'] },
  );
  let output = '';
  let startError: Error | undefined;
  child.stdout.on('data', (chunk: Buffer) => {
    output += chunk.toString();
  });
  child.stderr.on('data', (chunk: Buffer) => {
    output += chunk.toString();
  });
  child.on('error', (error) => {
    startError = error;
  });
  const endpoint = 'http://127.0.0.1:' + port;
  const client = new DynamoDBClient({
    endpoint,
    region: 'us-east-2',
    credentials: { accessKeyId: 'local', secretAccessKey: 'local' },
    maxAttempts: 1,
  });
  async function cleanup() {
    client.destroy();
    child.kill('SIGTERM');
    await Promise.race([
      new Promise<void>((resolve) => child.once('exit', () => resolve())),
      setTimeout(3000),
    ]);
    if (child.exitCode === null) child.kill('SIGKILL');
    await rm(work, { recursive: true, force: true });
  }
  try {
    let ready = false;
    for (let attempt = 0; attempt < 120; attempt++) {
      if (startError || child.exitCode !== null)
        throw new Error('DynamoDB Local startup failed: ' + (startError?.message ?? output));
      try {
        await client.send(new ListTablesCommand({}));
        ready = true;
        break;
      } catch {
        await setTimeout(250);
      }
    }
    if (!ready) throw new Error('DynamoDB Local did not become ready: ' + output);
    project.provide('accountEndpoint', endpoint);
    console.log(
      'DynamoDB Local verified archive: ' + digest + '; isolated in-memory service at ' + endpoint,
    );
  } catch (error) {
    await cleanup();
    throw error;
  }
  return cleanup;
}
