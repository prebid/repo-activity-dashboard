import { writeFileSync } from 'node:fs';
import { encodeActivitySnapshot, readActivityRows } from '../src/server/activity-database';

// Writes the activity snapshot production builds carry, from a github-activity-db SQLite file:
// npm run data:snapshot -- /absolute/path/github_activity.local.db
const [path] = process.argv.slice(2);
if (!path) throw new Error('Usage: npm run data:snapshot -- <github-activity-db file>');
const rows = readActivityRows(path);
if (!rows.run) throw new Error('The activity database has no finished sync run.');
const data = encodeActivitySnapshot(rows);
writeFileSync(
  'src/server/activity-snapshot.json',
  JSON.stringify({ format: 1, finishedAt: rows.run.finished_at, data }, null, 2) + '\n',
);
console.log(
  `Wrote src/server/activity-snapshot.json: ${rows.pullRequests.length} pull requests, run ${rows.run.id}, ${data.length} characters.`,
);
