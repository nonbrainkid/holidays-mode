import { test } from 'node:test';
import assert from 'node:assert/strict';
import { RunSync } from '../lib/run-sync.ts';
const move = { slot: 0, x: 0, y: 0, rotation: 0 };
test('uncertain checkpoint retries the identical request before finishing', async () => {
  let attempts = 0;
  const requests = [];
  const sync = new RunSync('test', async (batch) => {
    requests.push(structuredClone(batch));
    if (++attempts === 1) throw new Error('connection lost after commit');
    return {
      revision: batch.revision + batch.moves.length,
      score: 10,
      finished: batch.finish,
      over: false,
    };
  });
  sync.add(move);
  await assert.rejects(sync.flush(false, 'Doni'));
  assert.equal(sync.pending.length, 1);
  await sync.flush(true, 'Doni');
  assert.deepEqual(requests[0], requests[1]);
  assert.equal(requests[2].moves.length, 0);
  assert.equal(requests[2].finish, true);
  assert.equal(sync.finished, true);
});
test('long queues are batched and concurrent flushes preserve every move once', async () => {
  const requests = [];
  const sync = new RunSync('test', async (batch) => {
    await new Promise((resolve) => setTimeout(resolve, 2));
    requests.push(structuredClone(batch));
    return {
      revision: batch.revision + batch.moves.length,
      score: 10,
      finished: batch.finish,
      over: false,
    };
  });
  for (let i = 0; i < 50; i++) sync.add(move);
  await Promise.all([sync.flush(false, 'Doni'), sync.flush(true, 'Doni')]);
  assert.equal(sync.revision, 50);
  assert.equal(sync.pending.length, 0);
  assert.equal(sync.finished, true);
  assert.equal(
    requests.reduce((n, r) => n + r.moves.length, 0),
    50,
  );
  assert.ok(requests.every((r) => r.moves.length <= 24));
});
test('an uncertain finish cannot accept more moves or duplicate a record', async () => {
  let failed = true;
  const sync = new RunSync('test', async (batch) => {
    if (failed) {
      failed = false;
      throw new Error('offline');
    }
    return {
      revision: batch.moves.length,
      score: 10,
      finished: true,
      over: false,
    };
  });
  sync.add(move);
  await assert.rejects(sync.flush(true, 'Doni'));
  assert.throws(() => sync.add(move), /awaiting confirmation/);
  await sync.flush(true, 'Doni');
  assert.equal(sync.finished, true);
});
