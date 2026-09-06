export type RedisCommand = (...args: (string | number)[]) => Promise<unknown>;
export class StorageUnavailable extends Error {}
export const redis: RedisCommand = async (...args) => {
  const url = process.env.UPSTASH_REDIS_REST_URL || process.env.KV_REST_API_URL;
  const token =
    process.env.UPSTASH_REDIS_REST_TOKEN || process.env.KV_REST_API_TOKEN;
  if (!url || !token)
    throw new StorageUnavailable('Leaderboard storage is not connected');
  let response: Response;
  try {
    response = await fetch(url, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(args),
      signal: AbortSignal.timeout(5000),
    });
  } catch {
    throw new StorageUnavailable(
      'Leaderboard storage is temporarily unavailable',
    );
  }
  if (!response.ok)
    throw new StorageUnavailable(
      'Leaderboard storage is temporarily unavailable',
    );
  const body = (await response.json()) as { result: unknown; error?: string };
  if (body.error)
    throw new StorageUnavailable(
      'Leaderboard storage could not complete the request',
    );
  return body.result;
};
export function storagePrefix() {
  return (
    process.env.LEADERBOARD_NAMESPACE ||
    `holidays:${process.env.VERCEL_ENV === 'production' ? 'production' : 'development'}:wallet-v1`
  );
}
