import { writeFile, chmod } from 'node:fs/promises';
import { resolveRuntimeSettings } from '../src/models/runtime-settings.ts';
/** @param {Record<string, string | undefined>} environment */
export function buildRuntimeSettings(environment) {
  return resolveRuntimeSettings(environment, {}, 'build');
}
/** @param {Record<string, string | undefined>} environment @param {string} path */
export async function writeRuntimeSettings(environment, path) {
  // Only the explicit non-secret fields above cross the build/runtime boundary.
  await writeRuntimeFile(path, JSON.stringify(buildRuntimeSettings(environment)) + '\n');
}
/** @param {string} path @param {string | Buffer} content */
export async function writeRuntimeFile(path, content) {
  await writeFile(path, content, { mode: 0o644 });
  // Explicit chmod handles restrictive umasks and an existing file's previous mode.
  await chmod(path, 0o644);
}
