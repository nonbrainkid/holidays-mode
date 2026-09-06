import { test } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { newEndless } from '../lib/endless-engine.ts';
import { nickname, verifyBatch } from '../server/game-service.ts';
const session = () => ({
  owner: 'player-a',
  destination: 'bali',
  state: { ...newEndless(13), hand: [0, 1, 2] },
  finished: false,
  lastRequest: '',
  createdAt: 0,
});
const batch = () => ({
  revision: 0,
  requestId: randomUUID(),
  moves: [{ slot: 0, x: 0, y: 0, rotation: 0 }],
  finish: true,
  score: 999999,
});
test('server derives the result from moves and ignores a submitted score', () => {
  const result = verifyBatch(session(), 'player-a', batch());
  assert.equal(result.session.state.score, 10);
  assert.equal(result.session.finished, true);
});
test('foreign, stale and illegal requests cannot update a score', () => {
  assert.throws(
    () => verifyBatch(session(), 'player-b', batch()),
    /different player/,
  );
  assert.throws(
    () => verifyBatch(session(), 'player-a', { ...batch(), revision: 1 }),
    /out of sync/,
  );
  assert.throws(
    () =>
      verifyBatch(session(), 'player-a', {
        ...batch(),
        moves: [{ slot: 0, x: 8, y: 0, rotation: 0 }],
      }),
    /game rules/,
  );
  assert.throws(
    () =>
      verifyBatch(session(), 'player-a', {
        ...batch(),
        moves: Array(25).fill({ slot: 0, x: 0, y: 0, rotation: 0 }),
      }),
    /Invalid move batch/,
  );
});
test('retrying a saved request is idempotent; a new request cannot change a finished run', () => {
  const input = batch(),
    first = verifyBatch(session(), 'player-a', input).session;
  assert.equal(verifyBatch(first, 'player-a', input).duplicate, true);
  assert.throws(
    () =>
      verifyBatch(first, 'player-a', {
        ...input,
        requestId: randomUUID(),
        revision: 1,
        moves: [],
      }),
    /already been saved/,
  );
});
test('names are bounded text and never interpreted as HTML', () => {
  assert.equal(nickname('  Doni  Mode  ', 'Guest'), 'Doni Mode');
  assert.equal(nickname('', 'Guest'), 'Guest');
  assert.throws(() => nickname('<script>', 'Guest'));
  assert.throws(() => nickname('a'.repeat(19), 'Guest'));
});
