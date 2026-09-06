# Holidays Mode

Vacation-themed block puzzle and $MODE token website for `holidaysmode.me`.

## Run

Use Node 24.20.0 on Windows (earlier Node 24 patches can abort after the vinext build due to an upstream libuv shutdown defect).

```sh
npm ci
npm run dev
npm test
npx tsc --noEmit
npm run build
```

Vercel serves `dist/client` and Node functions in `api/`. For local API support, run `npm run dev:api` in a second terminal; Vite proxies `/api` to port 3001. Pull server environment variables with Vercel CLI; never commit `.env.local`.

Live website: https://holidaysmode.me · Private source: https://github.com/nonbrainkid/holidays-mode

## Product

- PLAY starts Endless Escape: an 8 × 8 grid, three replenishing pieces, free rotation, row/column clears and consecutive-clear bonuses. No timer or final level; the run ends when no piece fits.
- Passport Quest remains available from the home screen and destination cards.
- The global TOP 20 uses server-replayed moves, atomic maximum-score updates and one best per verified wallet. Personal rank is available below the TOP even outside the first 20.
- Connect an injected EVM wallet (EIP-6963 / EIP-1193), switch/add Robinhood Chain mainnet (4663), and sign an expiring EIP-4361 message. Nonces are single-use and same-origin. No transactions or token approvals are requested. Smart-wallet signatures are checked on RH using EIP-1271.
- Game sessions last 24 hours since the last checkpoint; wallet sign-in lasts seven days. Ranking, profile and best-record keys have **no expiry**. Disconnecting, clearing cookies and using another device do not remove wallet records; re-sign with the same wallet to retrieve them.
- Finish Run → Save to TOP commits a record. A game in progress is not restored after a page reload. Practice runs during a service outage remain local and cannot enter the global TOP.

- Bali → Tokyo → Ibiza → Rio, matching the supplied X identity.
- Complete all eight puzzle pieces to stamp a passport and collect a postcard.
- Unlimited time; optional speed bonus. Six solvable layouts rotate by UTC day and destination.
- Personal best and unique daily completions stay in browser storage. Cross-tab merges preserve progress.
- Tap or keyboard controls; reduce-motion support; responsive layouts.
- `/brand-kit` includes the visual identity guide and original artwork downloads.
- $MODE: `0x596adCD3b7fa264Bb17660ADb05560E151f141Fe` on Robinhood Chain (4663). Name and symbol were read from the contract through the official RPC.

## Token handoff

Verified name, symbol and contract are in `lib/token-config.ts`. Add a verified token-specific pons trading URL when available. No holder discount, NFT, hotel booking or yield has been implemented or promised.

## Leaderboard operations

Upstash Redis is provisioned via Vercel Marketplace on the Free plan with eviction, automatic paid upgrade and the production pack disabled. Required server-only variables: `KV_REST_API_URL` and `KV_REST_API_TOKEN` (or `UPSTASH_REDIS_REST_URL` / `UPSTASH_REDIS_REST_TOKEN`). The public client never receives these credentials.

Production keys use `holidays:production:wallet-v1`. This namespace is independent of code deployments and must remain stable. Local development uses a separate namespace; verification creates and removes a random QA namespace. Never flush the database. Lower scores and duplicate retries cannot overwrite a higher score. The best-record hash also preserves the data needed to rebuild ranking/profile indexes.

`npm run verify:api` exercises real storage, wallet signatures, nonce reuse, cross-browser recovery, score validation, simultaneous saves and non-expiring records. It leaves no test records in the live TOP.

`npm run leaderboard:backup` exports the current environment's best records to ignored local `backups/`. Take an export before changing storage providers or namespaces. This is a manual backup, not a scheduled or offsite backup service. The free provider's availability/quotas still apply; no storage system is a guarantee against all data loss.

The leaderboard verifies legal game moves and wallet ownership; it is not bot-proof or Sybil-proof and must not be treated as an audited cash-prize competition. Public display names and addresses are visible in standings. No token ownership gating or wallet-synced passport stamps are implemented.

Network source: https://docs.robinhood.com/chain/connecting/. `RH_RPC_URL` can override the public rate-limited RPC for smart-wallet checks. Ordinary EOA signatures verify locally without RPC.

## Artwork and data

Logo and banner: user-provided assets. Map: Natural Earth public-domain land geometry; see `lib/world-map.json`. Fonts: Archivo, Nunito Sans and Space Mono, SIL Open Font License via Fontsource. Personal stamps and scores are editable client data, not trusted records for paid rewards.
