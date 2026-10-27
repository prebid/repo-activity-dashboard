import { cp, access } from "node:fs/promises";
import { bundleReports } from './bundle-report-data.mjs';
// Report files stay in the server artifact, never in public assets.
await cp("store", "report-data", { recursive: true });
await access("report-data/sheets/github-mapping.json");
try {
  await access("public/store");
  throw new Error('Reporting files must not be public assets.');
} catch (error) {
  if (error.code !== 'ENOENT') throw error;
}
await bundleReports();
