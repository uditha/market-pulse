# MarketPulse

Sri Lanka financial data app — **Money Market first**. Verified CBSL figures, search-first web + mobile, ops review queue.

## Stack (Jul 2026)

- Expo SDK 57 + Expo Router
- Next.js 16 App Router
- Fastify 5 API
- Better Auth (MIT)
- Drizzle + SQLite (local)
- Python CBSL extractors
- Stripe Pro ($2.99–4.99)

## Quick start

```bash
pnpm install
pnpm --filter @lankapulse/shared build
pnpm db:seed
pnpm --filter @lankapulse/api dev   # :4000
pnpm --filter @lankapulse/web dev   # :3000
pnpm --filter @lankapulse/mobile start
```

### Expo Go note (iOS)

Mobile is pinned to **Expo SDK 54** — that matches the App Store Expo Go build (newer SDKs are often stuck in Apple review).

```bash
pnpm --filter @lankapulse/mobile start
```

If it still fails: check Expo Go → Profile for the supported SDK, or use the iOS Simulator (`npx expo start --ios`).

Optional CBSL ingest (API must be running):

```bash
pnpm extract
# or dry-run:
pnpm --filter @lankapulse/extractors dev
```

## Apps

| Path | Role |
|------|------|
| `apps/web` | Search-first terminal, series pages, ops queue, auth, pricing |
| `apps/mobile` | Morning brief + search (Expo) |
| `apps/api` | Series/search/ingest/review/billing API |
| `packages/db` | Schema + seed |
| `packages/shared` | Series catalog + Zod |
| `services/extractors` | CBSL HTML/table ingest |

## Env

Copy `.env.example` → `.env`. Stripe keys optional (demo checkout message if missing).
