import { rotate, type Cell } from './game-engine.ts';

export const ENDLESS_SIZE = 8;
export const SHAPES: Cell[][] = [
  [[0, 0]],
  [
    [0, 0],
    [1, 0],
  ],
  [
    [0, 0],
    [1, 0],
    [2, 0],
  ],
  [
    [0, 0],
    [1, 0],
    [2, 0],
    [3, 0],
  ],
  [
    [0, 0],
    [1, 0],
    [0, 1],
    [1, 1],
  ],
  [
    [0, 0],
    [0, 1],
    [1, 1],
  ],
  [
    [0, 0],
    [0, 1],
    [0, 2],
    [1, 2],
  ],
  [
    [0, 0],
    [1, 0],
    [2, 0],
    [1, 1],
  ],
  [
    [1, 0],
    [2, 0],
    [0, 1],
    [1, 1],
  ],
  [
    [0, 0],
    [1, 0],
    [1, 1],
    [2, 1],
  ],
  [
    [0, 0],
    [1, 0],
    [0, 1],
    [1, 1],
    [0, 2],
    [1, 2],
  ],
  [
    [0, 0],
    [1, 0],
    [2, 0],
    [0, 1],
    [1, 1],
    [2, 1],
    [0, 2],
    [1, 2],
    [2, 2],
  ],
];
export const ENDLESS_COLORS = [
  '#FF805F',
  '#68C7E8',
  '#8ECF93',
  '#FFA889',
  '#94D9EF',
  '#FFD2A1',
];
export type EndlessMove = {
  slot: number;
  x: number;
  y: number;
  rotation: number;
};
export type EndlessState = {
  rng: number;
  board: number[];
  hand: (number | null)[];
  score: number;
  combo: number;
  lines: number;
  turn: number;
  over: boolean;
};
export type MoveResult = {
  state: EndlessState;
  cleared: number[];
  linesCleared: number;
  points: number;
};
function random(value: number) {
  let next = value | 0;
  next ^= next << 13;
  next ^= next >>> 17;
  next ^= next << 5;
  return next >>> 0;
}
function deal(state: EndlessState): EndlessState {
  let rng = state.rng;
  const hand = Array.from({ length: 3 }, () => {
    rng = random(rng);
    return rng % SHAPES.length;
  });
  return { ...state, rng, hand };
}
export function newEndless(seed: number): EndlessState {
  if (!Number.isInteger(seed) || seed < 1 || seed > 0xffffffff)
    throw new Error('Invalid seed');
  return deal({
    rng: seed,
    board: Array(64).fill(0),
    hand: [],
    score: 0,
    combo: 0,
    lines: 0,
    turn: 0,
    over: false,
  });
}
export function endlessCanPlace(
  state: EndlessState,
  move: EndlessMove,
): boolean {
  const { slot, x, y, rotation } = move;
  if (
    state.over ||
    ![slot, x, y, rotation].every(Number.isInteger) ||
    slot < 0 ||
    slot > 2 ||
    rotation < 0 ||
    rotation > 3 ||
    x < 0 ||
    y < 0 ||
    x >= 8 ||
    y >= 8
  )
    return false;
  const shape = state.hand[slot];
  if (shape === null || shape === undefined) return false;
  return rotate(SHAPES[shape], rotation).every(
    ([dx, dy]) =>
      x + dx < 8 && y + dy < 8 && state.board[(y + dy) * 8 + x + dx] === 0,
  );
}
export function hasEndlessMove(state: EndlessState): boolean {
  if (state.over) return false;
  for (let slot = 0; slot < 3; slot++)
    if (state.hand[slot] !== null)
      for (let rotation = 0; rotation < 4; rotation++)
        for (let y = 0; y < 8; y++)
          for (let x = 0; x < 8; x++)
            if (endlessCanPlace(state, { slot, x, y, rotation })) return true;
  return false;
}
export function placeEndless(
  state: EndlessState,
  move: EndlessMove,
): MoveResult {
  if (!endlessCanPlace(state, move)) throw new Error('That piece does not fit');
  const shape = state.hand[move.slot]!,
    board = state.board.slice(),
    cells = rotate(SHAPES[shape], move.rotation);
  for (const [dx, dy] of cells)
    board[(move.y + dy) * 8 + move.x + dx] =
      (shape % ENDLESS_COLORS.length) + 1;
  const rows: number[] = [],
    columns: number[] = [];
  for (let i = 0; i < 8; i++) {
    if (Array.from({ length: 8 }, (_, x) => board[i * 8 + x]).every(Boolean))
      rows.push(i);
    if (Array.from({ length: 8 }, (_, y) => board[y * 8 + i]).every(Boolean))
      columns.push(i);
  }
  const cleared = new Set<number>();
  for (const row of rows) for (let x = 0; x < 8; x++) cleared.add(row * 8 + x);
  for (const column of columns)
    for (let y = 0; y < 8; y++) cleared.add(y * 8 + column);
  for (const index of cleared) board[index] = 0;
  const linesCleared = rows.length + columns.length,
    combo = linesCleared ? state.combo + 1 : 0;
  const points =
    cells.length * 10 + linesCleared * 100 + Math.max(0, combo - 1) * 50;
  const hand = state.hand.slice();
  hand[move.slot] = null;
  let next = {
    ...state,
    board,
    hand,
    score: state.score + points,
    combo,
    lines: state.lines + linesCleared,
    turn: state.turn + 1,
    over: false,
  };
  if (!Number.isSafeInteger(next.score)) throw new Error('Score limit reached');
  if (hand.every((value) => value === null)) next = deal(next);
  next.over = !hasEndlessMove(next);
  return { state: next, cleared: [...cleared], linesCleared, points };
}
export function replayEndless(
  state: EndlessState,
  moves: EndlessMove[],
): EndlessState {
  return moves.reduce(
    (current, move) => placeEndless(current, move).state,
    state,
  );
}
