import {
  createPublicClient,
  http,
  verifyMessage,
  type Address,
  type Hex,
} from 'viem';
import { createSiweMessage } from 'viem/siwe';
import { RH_CHAIN } from '../lib/chain.ts';
export type Challenge = {
  address: Address;
  message: string;
  origin: string;
  expiresAt: number;
};
export function makeChallenge(
  address: Address,
  origin: string,
  nonce: string,
  now = Date.now(),
): Challenge {
  const expiresAt = now + 300000;
  return {
    address,
    origin,
    expiresAt,
    message: createSiweMessage({
      address,
      chainId: RH_CHAIN.id,
      domain: new URL(origin).host,
      uri: origin,
      version: '1',
      nonce,
      issuedAt: new Date(now),
      expirationTime: new Date(expiresAt),
      statement:
        'Link your wallet to Holidays Mode and save your game records. This does not authorize transactions or access to funds.',
    }),
  };
}
export async function validProof(
  challenge: Challenge,
  message: string,
  signature: Hex,
  origin: string,
  now = Date.now(),
) {
  if (
    challenge.expiresAt <= now ||
    challenge.origin !== origin ||
    challenge.message !== message
  )
    return false;
  try {
    if (await verifyMessage({ address: challenge.address, message, signature }))
      return true;
  } catch {}
  try {
    return await createPublicClient({
      chain: RH_CHAIN,
      transport: http(
        process.env.RH_RPC_URL || RH_CHAIN.rpcUrls.default.http[0],
        { timeout: 6000, retryCount: 0 },
      ),
    }).verifyMessage({ address: challenge.address, message, signature });
  } catch {
    return false;
  }
}
