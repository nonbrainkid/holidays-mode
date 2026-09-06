let session: Promise<void> | null = null;
// Serialize first-session creation so game start and wallet login share one cookie.
async function ensureSession() {
  if (!session)
    session = fetch('/api/wallet', {
      cache: 'no-store',
      signal: AbortSignal.timeout(10000),
    })
      .then((response) => {
        if (!response.ok)
          throw new Error('Could not start a session. Please retry.');
      })
      .catch((error) => {
        session = null;
        throw error;
      });
  return session;
}
export async function requestApi<T>(path: string, body?: unknown): Promise<T> {
  await ensureSession();
  const response = await fetch(
    path,
    body
      ? {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
          signal: AbortSignal.timeout(10000),
        }
      : { cache: 'no-store', signal: AbortSignal.timeout(10000) },
  );
  const data = await response.json();
  if (!response.ok)
    throw new Error(
      data.error || 'Could not reach Holidays Mode. Please retry.',
    );
  return data as T;
}
