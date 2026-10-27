// Explicit account-test configuration. Real file/env parsing has its own boundary tests.
import { resolveRuntimeSettings } from '@/models/runtime-settings';
export function getRuntimeSettings() {
  return resolveRuntimeSettings(process.env, { region: 'us-east-2' });
}
