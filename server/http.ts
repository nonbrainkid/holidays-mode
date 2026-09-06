import type { IncomingMessage, ServerResponse } from 'node:http';
import { createHash, randomBytes } from 'node:crypto';
import { redis, storagePrefix } from './redis.ts';
import { GameRequestError } from './game-service.ts';
export type Request = IncomingMessage & { body?: unknown };
const secure = () => process.env.VERCEL === '1';
const cookie = () => (secure() ? '__Host-hm_player' : 'hm_player');
export function identity(req: Request) {
  const value = req.headers.cookie
    ?.split(';')
    .map((part) => part.trim())
    .find((part) => part.startsWith(cookie() + '='))
    ?.slice(cookie().length + 1);
  return value && /^[a-f0-9]{48}$/.test(value) ? value : null;
}
export function ensureIdentity(req: Request, res: ServerResponse) {
  const owner = identity(req) || randomBytes(24).toString('hex');
  res.setHeader(
    'Set-Cookie',
    `${cookie()}=${owner}; Path=/; HttpOnly; SameSite=Lax; Max-Age=31536000${secure() ? '; Secure' : ''}`,
  );
  return owner;
}
export function send(res: ServerResponse, status: number, body: unknown) {
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.end(JSON.stringify(body));
}
export function requestOrigin(req: Request) {
  const origin = req.headers.origin;
  if (!origin)
    throw new GameRequestError(403, 'Open Holidays Mode to continue.');
  let parsed: URL;
  try {
    parsed = new URL(origin);
  } catch {
    throw new GameRequestError(403, 'Invalid origin.');
  }
  const allowed = secure()
    ? [
        'https://holidaysmode.me',
        'https://holidays-mode.vercel.app',
        ...(process.env.VERCEL_URL
          ? [`https://${process.env.VERCEL_URL}`]
          : []),
      ]
    : [
        'http://localhost:3000',
        'http://127.0.0.1:3000',
        'http://127.0.0.1:3001',
      ];
  if (!allowed.includes(parsed.origin) || parsed.host !== req.headers.host)
    throw new GameRequestError(
      403,
      'Open the game on Holidays Mode to continue.',
    );
  return parsed.origin;
}
export function jsonInput(req: Request) {
  requestOrigin(req);
  if (!req.headers['content-type']?.startsWith('application/json'))
    throw new GameRequestError(415, 'JSON is required.');
  const raw =
    typeof req.body === 'string' ? req.body : JSON.stringify(req.body || null);
  if (Buffer.byteLength(raw) > 12000)
    throw new GameRequestError(413, 'Request is too large.');
  const body = JSON.parse(raw);
  if (!body || typeof body !== 'object' || Array.isArray(body))
    throw new GameRequestError(400, 'Invalid request.');
  return body as Record<string, unknown>;
}
export async function rateLimit(
  req: Request,
  res: ServerResponse,
  action: string,
  limit: number,
) {
  const forwarded = req.headers['x-forwarded-for'],
    ip =
      (Array.isArray(forwarded) ? forwarded[0] : forwarded)?.split(',')[0] ||
      req.socket.remoteAddress ||
      'unknown';
  const key =
    storagePrefix() +
    ':rate:' +
    action +
    ':' +
    createHash('sha256').update(ip).digest('hex').slice(0, 24);
  const n = Number(
    await redis(
      'EVAL',
      "local n=redis.call('INCR',KEYS[1]); if n==1 then redis.call('EXPIRE',KEYS[1],60) end; return n",
      1,
      key,
    ),
  );
  if (n > limit) {
    res.setHeader('Retry-After', '60');
    throw new GameRequestError(429, 'A little break. Try again in a minute.');
  }
}
export async function linkedWallet(
  owner: string | null,
): Promise<string | null> {
  if (!owner) return null;
  const value = await redis('GET', storagePrefix() + ':wallet:' + owner);
  return typeof value === 'string' && /^0x[a-f0-9]{40}$/.test(value)
    ? value
    : null;
}
