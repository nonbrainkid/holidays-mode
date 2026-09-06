import {
  replayEndless,
  type EndlessState,
  type EndlessMove,
} from '../lib/endless-engine.ts';
export type GameSession = {
  owner: string;
  destination: string;
  state: EndlessState;
  finished: boolean;
  lastRequest: string;
  createdAt: number;
};
export class GameRequestError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}
export function nickname(value: unknown, fallback: string): string {
  if (typeof value !== 'string' || !value.trim()) return fallback;
  const name = value.normalize('NFKC').trim().replace(/\s+/g, ' ');
  if (name.length < 2 || name.length > 18 || !/^[-\p{L}\p{N}_ ]+$/u.test(name))
    throw new GameRequestError(
      400,
      'Use 2–18 letters, numbers, spaces, dashes or underscores.',
    );
  return name;
}
export function verifyBatch(
  session: GameSession,
  owner: string,
  input: Record<string, unknown>,
): { session: GameSession; duplicate: boolean } {
  if (session.owner !== owner)
    throw new GameRequestError(403, 'This run belongs to a different player.');
  const { revision, requestId, moves, finish } = input;
  if (
    typeof requestId !== 'string' ||
    !/^[a-f0-9-]{36}$/i.test(requestId) ||
    !Number.isSafeInteger(revision) ||
    (revision as number) < 0 ||
    typeof finish !== 'boolean' ||
    !Array.isArray(moves) ||
    moves.length > 24
  )
    throw new GameRequestError(400, 'Invalid move batch.');
  if (requestId === session.lastRequest) return { session, duplicate: true };
  if (session.finished)
    throw new GameRequestError(409, 'This run has already been saved.');
  if (revision !== session.state.turn)
    throw new GameRequestError(
      409,
      'The run is out of sync. Retry the same moves.',
    );
  const clean: EndlessMove[] = moves.map((value) => {
    if (!value || typeof value !== 'object')
      throw new GameRequestError(400, 'Invalid move.');
    const move = value as EndlessMove;
    if (![move.slot, move.x, move.y, move.rotation].every(Number.isInteger))
      throw new GameRequestError(400, 'Invalid move.');
    return { slot: move.slot, x: move.x, y: move.y, rotation: move.rotation };
  });
  let state: EndlessState;
  try {
    state = replayEndless(session.state, clean);
  } catch {
    throw new GameRequestError(400, 'A move does not follow the game rules.');
  }
  return {
    session: { ...session, state, finished: finish, lastRequest: requestId },
    duplicate: false,
  };
}
