import { cp, access } from "node:fs/promises";
// Report files stay in the server artifact, never in public assets.
await cp("store", "report-data", { recursive: true });
await access("report-data/sheets/github-mapping.json");
try {
  await access("public/store");
} catch (error) {
  if (error.code === "ENOENT") process.exit(0);
  throw error;
}
throw new Error(
  "Remove public/store before building: reporting files must not be public assets.",
);
