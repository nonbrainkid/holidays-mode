import type { ServerResponse } from 'node:http';
import { randomBytes, randomUUID } from 'node:crypto';
import { newEndless } from '../lib/endless-engine.ts';
import { DESTINATIONS } from '../lib/destinations.ts';
import { redis, storagePrefix } from '../server/redis.ts';
import {
  GameRequestError,
  nickname,
  verifyBatch,
  type GameSession,
} from '../server/game-service.ts';
import {
  identity,
  ensureIdentity,
  jsonInput,
  linkedWallet,
  rateLimit,
  send,
  type Request,
} from '../server/http.ts';
import { SAVE_RUN_SCRIPT } from '../server/save-run.ts';
export default async function handler(req: Request, res: ServerResponse) {
  res.setHeader('Cache-Control', 'no-store');
  const prefix = storagePrefix();
  try {
    if (req.method === 'GET') {
      const me = await linkedWallet(identity(req));
      const list = (await redis(
          'ZREVRANGE',
          prefix + ':top',
          0,
          19,
          'WITHSCORES',
        )) as string[],
        ids = list.filter((_, index) => index % 2 === 0);
      const profiles = ids.length
        ? ((await redis('HMGET', prefix + ':profiles', ...ids)) as (
            | string
            | null
          )[])
        : [];
      const entry = (
        address: string,
        rank: number,
        score: number,
        raw: string | null,
      ) => {
        let profile: {
          name: string;
          destination: string;
          lines: number;
        } | null = null;
        try {
          profile = JSON.parse(raw || 'null');
        } catch {}
        return {
          rank,
          address,
          name: profile?.name || 'Traveler',
          destination: profile?.destination || 'bali',
          score,
          lines: profile?.lines || 0,
        };
      };
      const entries = ids.map((address, index) =>
        entry(address, index + 1, Number(list[index * 2 + 1]), profiles[index]),
      );
      let personal = null;
      if (me) {
        const rank = await redis('ZREVRANK', prefix + ':top', me);
        if (rank !== null) {
          const score = await redis('ZSCORE', prefix + ':top', me),
            profile = (await redis('HGET', prefix + ':profiles', me)) as
              | string
              | null;
          personal = entry(me, Number(rank) + 1, Number(score), profile);
        }
      }
      send(res, 200, {
        entries,
        personal,
        scope: 'global',
        updatedAt: new Date().toISOString(),
      });
      return;
    }
    if (req.method !== 'POST') {
      res.setHeader('Allow', 'GET, POST');
      send(res, 405, { error: 'Method not allowed' });
      return;
    }
    const input = jsonInput(req);
    if (input.action !== 'start' && input.action !== 'moves')
      throw new GameRequestError(400, 'Unknown action.');
    await rateLimit(
      req,
      res,
      'game-' + input.action,
      input.action === 'start' ? 12 : 90,
    );
    if (input.action === 'start') {
      if (
        typeof input.destination !== 'string' ||
        !DESTINATIONS.some((d) => d.id === input.destination)
      )
        throw new GameRequestError(400, 'Choose a destination.');
      const owner = ensureIdentity(req, res),
        name = nickname(
          input.nickname,
          'Traveler-' + owner.slice(0, 4).toUpperCase(),
        ),
        seed = randomBytes(4).readUInt32BE() || 1,
        id = randomUUID();
      const session: GameSession = {
        owner,
        destination: input.destination,
        state: newEndless(seed),
        finished: false,
        lastRequest: '',
        createdAt: Date.now(),
      };
      await redis(
        'SET',
        prefix + ':run:' + id,
        JSON.stringify(session),
        'EX',
        86400,
      );
      send(res, 200, { sessionId: id, seed, name });
      return;
    }
    const owner = identity(req);
    if (!owner)
      throw new GameRequestError(
        401,
        'Your player session expired. Start a new run.',
      );
    if (
      typeof input.sessionId !== 'string' ||
      !/^[a-f0-9-]{36}$/i.test(input.sessionId)
    )
      throw new GameRequestError(400, 'Invalid run.');
    const key = prefix + ':run:' + input.sessionId,
      raw = (await redis('GET', key)) as string | null;
    if (!raw)
      throw new GameRequestError(
        410,
        'This run expired after 24 hours without syncing. Start a new run.',
      );
    const old = JSON.parse(raw) as GameSession,
      { session, duplicate } = verifyBatch(old, owner, input);
    if (!duplicate) {
      const wallet = session.finished ? await linkedWallet(owner) : null;
      if (session.finished && !wallet)
        throw new GameRequestError(
          401,
          'Connect and verify your wallet to save to the TOP.',
        );
      const profile = JSON.stringify({
        name: nickname(
          input.nickname,
          'Traveler-' + owner.slice(0, 4).toUpperCase(),
        ),
        destination: session.destination,
        lines: session.state.lines,
        completedAt: Date.now(),
      });
      const committed = Number(
        await redis(
          'EVAL',
          SAVE_RUN_SCRIPT,
          5,
          key,
          prefix + ':top',
          prefix + ':profiles',
          prefix + ':wallet:' + owner,
          prefix + ':best-runs',
          old.state.turn,
          old.lastRequest,
          JSON.stringify(session),
          86400,
          wallet || '',
          profile,
        ),
      );
      if (committed === -3)
        throw new GameRequestError(
          401,
          'Your wallet connection changed. Reconnect and retry.',
        );
      if (committed < 0)
        throw new GameRequestError(
          409,
          'The run changed while saving. Retry the same moves.',
        );
    }
    send(res, 200, {
      revision: session.state.turn,
      score: session.state.score,
      finished: session.finished,
      over: session.state.over,
    });
  } catch (error) {
    if (error instanceof GameRequestError) {
      send(res, error.status, { error: error.message });
      return;
    }
    if (error instanceof SyntaxError || error instanceof TypeError) {
      send(res, 400, { error: 'Invalid game request.' });
      return;
    }
    send(res, 503, {
      error: 'The global leaderboard is temporarily unavailable. Please retry.',
    });
  }
}
