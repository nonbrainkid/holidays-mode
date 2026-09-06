# Holidays Mode

Vacation-themed block puzzle and pre-launch token website for `holidaysmode.me`.

## Run

Use Node 24.20.0 on Windows (earlier Node 24 patches can abort after the vinext build due to an upstream libuv shutdown defect).

```sh
npm ci
npm run dev
npm test
npx tsc --noEmit
npm run build
```

Static Vercel output: `dist/client`. Configuration is in `vercel.json`; the existing `.openai` registration is unused for this Vercel delivery. No server runtime, payment credentials or environment secrets are required.

## Product

- Bali → Tokyo → Ibiza → Rio, matching the supplied X identity.
- Complete all eight puzzle pieces to stamp a passport and collect a postcard.
- Unlimited time; optional speed bonus. Six solvable layouts rotate by UTC day and destination.
- Personal best and unique daily completions stay in browser storage. Cross-tab merges preserve progress.
- Tap or keyboard controls; reduce-motion support; responsive layouts.
- `/brand-kit` includes the visual identity guide and original artwork downloads.
- Token information stays in pre-launch state until verified configuration is inserted.

## Token handoff

Edit `lib/token-config.ts` after the pons launch: verified symbol, exact contract address, actual pons trading URL. Confirm the explorer and trade links before publishing that update. The token has not been deployed by this project. No holder discount, NFT, hotel booking or yield has been implemented or promised.

## Sources

Logo and banner: user-provided assets. Map: Natural Earth public-domain land geometry; see `lib/world-map.json`. Fonts: Archivo, Nunito Sans and Space Mono, SIL Open Font License via Fontsource. Personal stamps and scores are editable client data, not trusted records for paid rewards.
