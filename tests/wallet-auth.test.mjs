import { test } from 'node:test';
import assert from 'node:assert/strict';
import { generatePrivateKey, privateKeyToAccount } from 'viem/accounts';
import { parseSiweMessage } from 'viem/siwe';
import { makeChallenge, validProof } from '../server/wallet-auth.ts';
import { RH_CHAIN, RH_CHAIN_HEX } from '../lib/chain.ts';
import { requestOrigin } from '../server/http.ts';
test('RH login binds a real signature to the wallet, domain, nonce, chain and expiry', async () => {
  const account = privateKeyToAccount(generatePrivateKey()),
    origin = 'https://holidaysmode.me',
    now = Date.now();
  const challenge = makeChallenge(account.address, origin, 'a1b2c3d4e5f6', now),
    message = parseSiweMessage(challenge.message);
  assert.equal(message.chainId, 4663);
  assert.equal(Number(RH_CHAIN_HEX), RH_CHAIN.id);
  assert.equal(message.domain, 'holidaysmode.me');
  assert.equal(message.uri, origin);
  assert.equal(message.nonce, 'a1b2c3d4e5f6');
  const signature = await account.signMessage({ message: challenge.message });
  assert.equal(
    await validProof(challenge, challenge.message, signature, origin, now),
    true,
  );
  assert.equal(
    await validProof(
      challenge,
      challenge.message + 'tampered',
      signature,
      origin,
      now,
    ),
    false,
  );
  assert.equal(
    await validProof(
      challenge,
      challenge.message,
      signature,
      'https://attacker.example',
      now,
    ),
    false,
  );
  assert.equal(
    await validProof(
      challenge,
      challenge.message,
      signature,
      origin,
      now + 300001,
    ),
    false,
  );
});
test('production accepts only trusted same-origin requests', () => {
  const old = process.env.VERCEL;
  process.env.VERCEL = '1';
  try {
    assert.equal(
      requestOrigin({
        headers: { origin: 'https://holidaysmode.me', host: 'holidaysmode.me' },
      }),
      'https://holidaysmode.me',
    );
    assert.throws(() =>
      requestOrigin({
        headers: {
          origin: 'https://attacker.example',
          host: 'attacker.example',
        },
      }),
    );
    assert.throws(() =>
      requestOrigin({
        headers: {
          origin: 'https://holidaysmode.me',
          host: 'attacker.example',
        },
      }),
    );
    assert.throws(() =>
      requestOrigin({ headers: { host: 'holidaysmode.me' } }),
    );
  } finally {
    if (old === undefined) delete process.env.VERCEL;
    else process.env.VERCEL = old;
  }
});
