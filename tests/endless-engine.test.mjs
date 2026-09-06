import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  newEndless,
  placeEndless,
  endlessCanPlace,
  hasEndlessMove,
  replayEndless,
} from '../lib/endless-engine.ts';
const empty = () => ({ ...newEndless(12345), hand: [0, 1, 2] });
test('seeded bags and replay are deterministic', () => {
  assert.deepEqual(newEndless(123), newEndless(123));
  assert.notDeepEqual(newEndless(123).hand, newEndless(999).hand);
  const moves = [
    { slot: 0, x: 0, y: 0, rotation: 0 },
    { slot: 1, x: 1, y: 0, rotation: 0 },
  ];
  assert.deepEqual(
    replayEndless(empty(), moves),
    placeEndless(placeEndless(empty(), moves[0]).state, moves[1]).state,
  );
});
test('moves reject overlap, invalid input, used slots and bounds without mutation', () => {
  const state = empty(),
    before = structuredClone(state);
  for (const move of [
    { slot: 3, x: 0, y: 0, rotation: 0 },
    { slot: 0, x: -1, y: 0, rotation: 0 },
    { slot: 1, x: 7, y: 7, rotation: 0 },
    { slot: 0, x: 0, y: 0, rotation: 4 },
  ])
    assert.equal(endlessCanPlace(state, move), false);
  const next = placeEndless(state, { slot: 0, x: 0, y: 0, rotation: 0 }).state;
  assert.deepEqual(state, before);
  assert.equal(
    endlessCanPlace(next, { slot: 0, x: 1, y: 1, rotation: 0 }),
    false,
  );
  assert.equal(
    endlessCanPlace(next, { slot: 1, x: 0, y: 0, rotation: 0 }),
    false,
  );
});
test('a row and column clear simultaneously without double counting the intersection', () => {
  const state = empty();
  for (let i = 1; i < 8; i++) {
    state.board[i] = 1;
    state.board[i * 8] = 1;
  }
  const result = placeEndless(state, { slot: 0, x: 0, y: 0, rotation: 0 });
  assert.equal(result.linesCleared, 2);
  assert.equal(result.cleared.length, 15);
  assert.equal(result.points, 210);
  assert.equal(result.state.board.filter(Boolean).length, 0);
});
test('new bags arrive continuously; clearing combo resets on a non-clearing move', () => {
  let state = empty();
  state.combo = 2;
  state = placeEndless(state, { slot: 0, x: 0, y: 0, rotation: 0 }).state;
  assert.equal(state.combo, 0);
  state = placeEndless(state, { slot: 1, x: 1, y: 1, rotation: 0 }).state;
  state = placeEndless(state, { slot: 2, x: 1, y: 2, rotation: 0 }).state;
  assert.equal(state.hand.filter((v) => v !== null).length, 3);
  assert.equal(state.turn, 3);
});
test('game over considers every rotation of every remaining piece', () => {
  const state = { ...empty(), board: Array(64).fill(1), hand: [1, null, null] };
  state.board[0] = 0;
  state.board[8] = 0;
  assert.equal(
    endlessCanPlace(state, { slot: 0, x: 0, y: 0, rotation: 0 }),
    false,
  );
  assert.equal(
    endlessCanPlace(state, { slot: 0, x: 0, y: 0, rotation: 1 }),
    true,
  );
  assert.equal(hasEndlessMove(state), true);
  state.board[8] = 1;
  assert.equal(hasEndlessMove(state), false);
});
