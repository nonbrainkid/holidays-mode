import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { randomUUID } from 'node:crypto';
import { generatePrivateKey, privateKeyToAccount } from 'viem/accounts';
import game from '../api/game.ts';
import wallet from '../api/wallet.ts';
import {
  newEndless,
  endlessCanPlace,
  placeEndless,
} from '../lib/endless-engine.ts';
import { redis } from '../server/redis.ts';
const prefix = 'holidays:qa:' + randomUUID();
process.env.LEADERBOARD_NAMESPACE = prefix;
process.env.VERCEL = '';
const keys = new Set([
  prefix + ':top',
  prefix + ':profiles',
  prefix + ':best-runs',
]);
const server = createServer(async (req, res) => {
  req.headers.host = '127.0.0.1:3001';
  const chunks = [];
  for await (const chunk of req) chunks.push(chunk);
  if (chunks.length) req.body = JSON.parse(Buffer.concat(chunks).toString());
  await (req.url === '/api/wallet' ? wallet : game)(req, res);
});
await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
const base = `http://127.0.0.1:${server.address().port}`;
function client() {
  let cookie = '';
  return async (path, body) => {
    const response = await fetch(base + path, {
      method: body ? 'POST' : 'GET',
      headers: {
        'Content-Type': 'application/json',
        Origin: 'http://127.0.0.1:3001',
        Cookie: cookie,
      },
      body: body ? JSON.stringify(body) : undefined,
    });
    const setCookie = response.headers.get('set-cookie');
    if (setCookie) {
      cookie = setCookie.split(';')[0];
      const owner = cookie.split('=')[1];
      keys.add(prefix + ':wallet:' + owner);
      keys.add(prefix + ':challenge:' + owner);
    }
    return { status: response.status, body: await response.json() };
  };
}
const a = client(),
  b = client(),
  account = privateKeyToAccount(generatePrivateKey());
async function authenticate(call) {
  const challenge = await call('/api/wallet', {
    action: 'challenge',
    address: account.address,
  });
  assert.equal(challenge.status, 200);
  const signature = await account.signMessage({
    message: challenge.body.message,
  });
  const proof = {
    action: 'verify',
    message: challenge.body.message,
    signature,
  };
  assert.equal((await call('/api/wallet', proof)).status, 200);
  assert.equal(
    (await call('/api/wallet', proof)).status,
    401,
    'nonce cannot be reused',
  );
}
async function run(call, movesCount, name) {
  const start = await call('/api/game', {
    action: 'start',
    destination: 'bali',
  });
  assert.equal(start.status, 200);
  keys.add(prefix + ':run:' + start.body.sessionId);
  let state = newEndless(start.body.seed);
  const moves = [];
  for (let turn = 0; turn < movesCount; turn++) {
    let found = null;
    for (let slot = 0; slot < 3 && !found; slot++)
      for (let rotation = 0; rotation < 4 && !found; rotation++)
        for (let y = 0; y < 8 && !found; y++)
          for (let x = 0; x < 8 && !found; x++) {
            const move = { slot, x, y, rotation };
            if (endlessCanPlace(state, move)) found = move;
          }
    assert.ok(found);
    state = placeEndless(state, found).state;
    moves.push(found);
  }
  const batch = {
    action: 'moves',
    sessionId: start.body.sessionId,
    requestId: randomUUID(),
    revision: 0,
    moves,
    finish: true,
    nickname: name,
    score: 999999999,
  };
  return { batch, state };
}
try {
  assert.equal((await a('/api/game')).body.entries.length, 0);
  const first = await run(a, 3, 'QA Traveler');
  assert.equal(
    (await a('/api/game', first.batch)).status,
    401,
    'unverified wallet cannot save',
  );
  await authenticate(a);
  const forged = {
    ...first.batch,
    requestId: randomUUID(),
    moves: [{ slot: 0, x: 99, y: 99, rotation: 0 }],
  };
  assert.equal((await a('/api/game', forged)).status, 400);
  assert.equal(
    (await b('/api/game', first.batch)).status,
    401,
    'another browser cannot submit this run',
  );
  const saved = await a('/api/game', first.batch);
  assert.equal(saved.status, 200, JSON.stringify(saved.body));
  assert.equal(saved.body.score, first.state.score);
  assert.equal((await a('/api/game', first.batch)).status, 200, 'safe retry');
  await authenticate(b);
  const board = (await b('/api/game')).body;
  assert.equal(board.entries.length, 1);
  assert.equal(board.personal.score, first.state.score);
  assert.equal(board.personal.address, account.address.toLowerCase());
  const other = await run(b, 1, 'QA Other');
  const [r1, r2] = await Promise.all([
    b('/api/game', other.batch),
    b('/api/game', other.batch),
  ]);
  assert.ok([200, 409].includes(r1.status));
  assert.ok([200, 409].includes(r2.status));
  assert.equal((await b('/api/game', other.batch)).status, 200);
  const best = Math.max(first.state.score, other.state.score);
  assert.equal((await b('/api/game')).body.personal.score, best);
  assert.equal(
    await redis('ZCARD', prefix + ':top'),
    1,
    'wallet only has one ranking entry',
  );
  assert.equal(
    await redis('TTL', prefix + ':top'),
    -1,
    'ranking never expires',
  );
  assert.equal(
    await redis('TTL', prefix + ':profiles'),
    -1,
    'profile never expires',
  );
  assert.equal(await redis('HLEN', prefix + ':best-runs'), 1);
  await b('/api/wallet', { action: 'disconnect' });
  assert.equal((await b('/api/game')).body.personal, null);
  assert.equal(
    (await b('/api/game')).body.entries[0].score,
    best,
    'disconnect does not delete records',
  );
  await authenticate(b);
  assert.equal(
    (await b('/api/game')).body.personal.score,
    best,
    'reconnect restores personal rank',
  );
  console.log(
    'Verified against live Redis: signed wallet login, nonce replay protection, legal score replay, wallet deduplication, concurrent saves, permanent ranking, cross-browser recovery and disconnect/reconnect.',
  );
} finally {
  // Only remove this test run’s randomly namespaced keys; never production data.
  let cursor = '0';
  do {
    const page = await redis(
      'SCAN',
      cursor,
      'MATCH',
      prefix + ':*',
      'COUNT',
      100,
    );
    cursor = page[0];
    for (const key of page[1]) {
      if (!key.startsWith(prefix + ':'))
        throw new Error('Unexpected cleanup key');
      keys.add(key);
    }
  } while (cursor !== '0');
  if (keys.size) await redis('DEL', ...keys);
  await new Promise((resolve) => server.close(resolve));
}
