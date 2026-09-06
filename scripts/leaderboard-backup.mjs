import { mkdir, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { redis, storagePrefix } from '../server/redis.ts';
const prefix = storagePrefix();
// One atomic read of immutable best-record fields; no sessions or secrets exported.
const records = await redis('HGETALL', prefix + ':best-runs');
const entries = [];
for (let i = 0; i < records.length; i += 2)
  entries.push({ address: records[i], ...JSON.parse(records[i + 1]) });
const directory = resolve('backups');
await mkdir(directory, { recursive: true });
const file = resolve(
  directory,
  `leaderboard-${new Date().toISOString().replace(/[:.]/g, '-')}.json`,
);
await writeFile(
  file,
  JSON.stringify(
    {
      version: 1,
      namespace: prefix,
      exportedAt: new Date().toISOString(),
      entries,
    },
    null,
    2,
  ),
  { flag: 'wx' },
);
console.log(`Exported ${entries.length} best records to ${file}`);
