export type Cell = [number, number];
export type Placement = { id: string; x: number; y: number; rotation: number };
export const SIZE = 6;
export const PIECES = [
  {
    id: 'camera',
    name: 'Camera',
    short: 'CAM',
    color: '#FF805F',
    cells: [
      [0, 0],
      [1, 0],
      [0, 1],
      [1, 1],
    ],
  },
  {
    id: 'shirt',
    name: 'Linen shirt',
    short: 'TEE',
    color: '#68C7E8',
    cells: [
      [0, 0],
      [1, 0],
      [2, 0],
      [1, 1],
    ],
  },
  {
    id: 'book',
    name: 'Beach read',
    short: 'READ',
    color: '#8ECF93',
    cells: [
      [0, 0],
      [1, 0],
      [0, 1],
      [1, 1],
      [0, 2],
      [1, 2],
    ],
  },
  {
    id: 'glasses',
    name: 'Sunglasses',
    short: 'SUN',
    color: '#FFA889',
    cells: [
      [0, 0],
      [1, 0],
      [2, 0],
    ],
  },
  {
    id: 'fins',
    name: 'Swim fins',
    short: 'SWIM',
    color: '#A6DFB1',
    cells: [
      [0, 0],
      [0, 1],
      [0, 2],
      [1, 2],
    ],
  },
  {
    id: 'water',
    name: 'Water bottle',
    short: 'H2O',
    color: '#94D9EF',
    cells: [
      [0, 0],
      [0, 1],
      [0, 2],
    ],
  },
  {
    id: 'phones',
    name: 'Headphones',
    short: 'PLAY',
    color: '#FFD2A1',
    cells: [
      [1, 0],
      [2, 0],
      [0, 1],
      [1, 1],
    ],
  },
  {
    id: 'hat',
    name: 'Sun hat',
    short: 'HAT',
    color: '#B4CEA8',
    cells: [
      [0, 0],
      [1, 0],
      [1, 1],
      [2, 1],
    ],
  },
] as {
  id: string;
  name: string;
  short: string;
  color: string;
  cells: Cell[];
}[];
export const BLOCKS = [
  [0, 1, 6, 7],
  [14, 15, 20, 21],
  [4, 5, 10, 11],
  [24, 25, 30, 31],
  [7, 8, 13, 14],
  [1, 2, 31, 32],
];
export function rotate(cells: Cell[], turns: number): Cell[] {
  let out = cells.map(([x, y]): Cell => [x, y]);
  for (let i = 0; i < ((turns % 4) + 4) % 4; i++)
    out = out.map(([x, y]): Cell => [-y, x]);
  const minX = Math.min(...out.map((c) => c[0])),
    minY = Math.min(...out.map((c) => c[1]));
  return out.map(([x, y]): Cell => [x - minX, y - minY]);
}
export function boardFor(
  placements: Placement[],
  blocks: number[] = [],
): (string | null)[] {
  const board: (string | null)[] = Array(SIZE * SIZE).fill(null);
  blocks.forEach((i) => {
    if (!Number.isInteger(i) || i < 0 || i >= 36)
      throw new Error('Invalid blocked cell');
    board[i] = '#';
  });
  const seen = new Set<string>();
  for (const p of placements) {
    const piece = PIECES.find((v) => v.id === p.id);
    if (
      !piece ||
      seen.has(p.id) ||
      ![p.x, p.y, p.rotation].every(Number.isInteger)
    )
      throw new Error('Invalid piece');
    seen.add(p.id);
    for (const [dx, dy] of rotate(piece.cells, p.rotation)) {
      const x = p.x + dx,
        y = p.y + dy;
      if (x < 0 || x >= SIZE || y < 0 || y >= SIZE || board[y * SIZE + x])
        throw new Error('Invalid placement');
      board[y * SIZE + x] = p.id;
    }
  }
  return board;
}
export function canPlace(
  placements: Placement[],
  id: string,
  x: number,
  y: number,
  rotation: number,
  blocks: number[] = [],
): boolean {
  if (
    ![x, y, rotation].every(Number.isInteger) ||
    placements.some((p) => p.id === id)
  )
    return false;
  const piece = PIECES.find((p) => p.id === id);
  if (!piece) return false;
  const board = boardFor(placements, blocks);
  return rotate(piece.cells, rotation).every(
    ([dx, dy]) =>
      x + dx >= 0 &&
      x + dx < SIZE &&
      y + dy >= 0 &&
      y + dy < SIZE &&
      !board[(y + dy) * SIZE + x + dx],
  );
}
export function scoreFor(
  placements: Placement[],
  blocks: number[] = [],
): number {
  const board = boardFor(placements, blocks);
  return (
    board.filter((v) => v && v !== '#').length * 25 +
    (placements.length === PIECES.length ? 200 : 0)
  );
}
export function daySeed(day: string): number {
  return [...day].reduce(
    (h, c) => (Math.imul(h, 31) + c.charCodeAt(0)) >>> 0,
    7,
  );
}
export function dailyBlocks(day: string, stop: number): number[] {
  return BLOCKS[(daySeed(day) + stop) % BLOCKS.length];
}
