import type { ServerResponse } from 'node:http';
import { randomBytes } from 'node:crypto';
import { getAddress, isAddress, type Hex } from 'viem';
import {
  ensureIdentity,
  jsonInput,
  linkedWallet,
  rateLimit,
  requestOrigin,
  send,
  type Request,
} from '../server/http.ts';
import {
  makeChallenge,
  validProof,
  type Challenge,
} from '../server/wallet-auth.ts';
import { redis, storagePrefix } from '../server/redis.ts';
import { GameRequestError } from '../server/game-service.ts';
export default async function handler(req: Request, res: ServerResponse) {
  res.setHeader('Cache-Control', 'no-store');
  try {
    if (req.method === 'GET') {
      const owner = ensureIdentity(req, res);
      send(res, 200, { address: await linkedWallet(owner) });
      return;
    }
    if (req.method !== 'POST') {
      res.setHeader('Allow', 'GET, POST');
      send(res, 405, { error: 'Method not allowed' });
      return;
    }
    const input = jsonInput(req),
      action = input.action;
    if (
      action !== 'challenge' &&
      action !== 'verify' &&
      action !== 'disconnect'
    )
      throw new GameRequestError(400, 'Invalid wallet action.');
    await rateLimit(req, res, 'wallet-' + action, 12);
    const owner = ensureIdentity(req, res),
      prefix = storagePrefix(),
      key = prefix + ':challenge:' + owner,
      authKey = prefix + ':wallet:' + owner,
      origin = requestOrigin(req);
    if (action === 'disconnect') {
      await redis('DEL', authKey, key);
      send(res, 200, { address: null });
      return;
    }
    if (action === 'challenge') {
      if (typeof input.address !== 'string' || !isAddress(input.address))
        throw new GameRequestError(400, 'Invalid wallet address.');
      const challenge = makeChallenge(
        getAddress(input.address),
        origin,
        randomBytes(16).toString('hex'),
      );
      await redis('SET', key, JSON.stringify(challenge), 'EX', 300);
      send(res, 200, { message: challenge.message });
      return;
    }
    if (
      typeof input.message !== 'string' ||
      typeof input.signature !== 'string' ||
      !/^0x[0-9a-f]+$/i.test(input.signature)
    )
      throw new GameRequestError(400, 'A wallet signature is required.');
    const raw = (await redis('GET', key)) as string | null;
    if (!raw)
      throw new GameRequestError(
        401,
        'The sign-in request expired. Connect again.',
      );
    const challenge = JSON.parse(raw) as Challenge;
    if (
      !(await validProof(
        challenge,
        input.message,
        input.signature as Hex,
        origin,
      ))
    )
      throw new GameRequestError(
        401,
        'The wallet signature could not be verified. Connect again.',
      );
    const address = challenge.address.toLowerCase();
    const committed = await redis(
      'EVAL',
      "if redis.call('GET',KEYS[1])~=ARGV[1] then return 0 end; redis.call('DEL',KEYS[1]); redis.call('SET',KEYS[2],ARGV[2],'EX',604800); return 1",
      2,
      key,
      authKey,
      raw,
      address,
    );
    if (Number(committed) !== 1)
      throw new GameRequestError(
        401,
        'This sign-in request was already used. Connect again.',
      );
    send(res, 200, { address });
  } catch (error) {
    if (error instanceof GameRequestError) {
      send(res, error.status, { error: error.message });
      return;
    }
    if (error instanceof SyntaxError) {
      send(res, 400, { error: 'Invalid wallet request.' });
      return;
    }
    send(res, 503, {
      error: 'Wallet sign-in is taking a break. Please try again.',
    });
  }
}
