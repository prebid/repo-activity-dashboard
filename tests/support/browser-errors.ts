import type { Page } from '@playwright/test';
export function observeBrowserErrors(page: Page) {
  const errors: string[] = [];
  const record = (error: Error) => errors.push(`[${page.url()}] ${error.stack || error.message}`);
  page.on('pageerror', record);
  return {
    assertClean() {
      if (errors.length) throw new Error('Unexpected browser errors:\n' + errors.join('\n'));
    },
    dispose() {
      page.off('pageerror', record);
    },
  };
}
