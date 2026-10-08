# AGENTS.md

This repository is **crypto-trading-demo**: a local paper-trading demo for Bitcoin.
Do not add customer names, client branding, or extra product names to docs or comments.

## Stack

- Next.js 15 (App Router) + React 19 + TailwindCSS 4 + ShadCN/UI
- Prisma + SQLite (`file:./prisma/dev.db`)
- NextAuth v5 **credentials** provider only (email + password)

Do **not** add MongoDB, Docker, Stripe, or OAuth (including Google). Keep auth as credentials NextAuth.

## Preferred local setup

```bash
npm install
DATABASE_URL="file:./prisma/dev.db" AUTH_SECRET="dev-secret-change-me" npx prisma db push
DATABASE_URL="file:./prisma/dev.db" AUTH_SECRET="dev-secret-change-me" npm run dev
```

Optional `.env` (do not commit secrets):

```env
DATABASE_URL="file:./prisma/dev.db"
AUTH_SECRET="dev-secret-change-me"
NEXTAUTH_URL="http://localhost:3000"
```

CoinGecko is optional. The app proxies BTC price through `/api/btc-price`. If CoinGecko is unreachable, the dashboard may fail to load live prices — do not add another market-data vendor.

## Project map

- `src/app/` — App Router pages (`/dashboard`, `/profile`, `/login`, `/register`)
- `src/actions/` — server actions for credentials auth and trades
- `src/auth.ts` — NextAuth credentials config
- `prisma/schema.prisma` — SQLite models (`User`, `Wallet`, `Trade`)

## Working rules

- Keep changes small and demo-safe.
- Do not introduce Mongo, Docker, Stripe, OAuth, or extra paid SaaS dependencies.
- New users start with a $10,000 USDT paper wallet.
