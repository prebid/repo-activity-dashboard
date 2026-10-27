import 'server-only';
import { AuthStateError } from './auth-errors';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import {
  validateRuntimeSettings,
  resolveRuntimeSettings,
  type RuntimeSettings,
} from '@/models/runtime-settings';
function readRuntimeSettings(): RuntimeSettings {
  let stored: Partial<RuntimeSettings> = {};
  for (const path of ['.dashboard-runtime.json', '.next/server/dashboard-runtime.json']) {
    try {
      const input: unknown = JSON.parse(readFileSync(resolve(process.cwd(), path), 'utf8'));
      stored = validateRuntimeSettings(input);
      break;
    } catch (error) {
      if (!(error instanceof Error && 'code' in error && error.code === 'ENOENT')) throw error;
    }
  }
  return resolveRuntimeSettings(process.env, stored);
}

let settings: RuntimeSettings | undefined;
export function getRuntimeSettings(): RuntimeSettings {
  try {
    return (settings ??= readRuntimeSettings());
  } catch (error) {
    throw new AuthStateError(
      'configuration',
      { cause: error },
      'Invalid server runtime configuration.',
    );
  }
}
