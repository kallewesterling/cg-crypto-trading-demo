---
name: start-tradesim
description: Pull the latest main branch and start the shared local TradeSim demo (Next.js on port 3000 and the SQLite database via Prisma). Use when the user asks to pull the latest, start the app, boot the demo, or start related services for this repository.
---

# Start TradeSim

Start the shared local demo. Port 3000 and `prisma/dev.db` belong to that demo. The verification helper (`.cursor/skills/verify-tradesim`) is a different workflow: it uses another port and a disposable sqlite file. Do not launch it here.

SQLite is a file. There is no database server, Docker, or other process to start.

## Before pulling

From the repo root, check branch, tracking, and working tree.

- Stay on `main` tracking `origin/main` with a clean working tree.
- If the tree is dirty, or the branch is not `main`, stop and report that. Do not stash, reset, or pull.

## Pull

```bash
git pull --ff-only origin main
```

If the pull is not a fast-forward, stop and report the state. Do not merge or rebase.

## Dependencies

Run `npm install` only when `node_modules` is missing, or when the pull changed `package.json` or `package-lock.json`. Otherwise skip it.

## Database

`.env` supplies `DATABASE_URL` and `AUTH_SECRET`. Do not print those values.

```bash
npx prisma generate && npx prisma db push
```

"Already in sync" is success. Prisma reads `.env` from the repo root.

## Dev server

If something is already listening on port 3000, leave it running and report `http://localhost:3000`. Do not start a second server.

Otherwise start the dev server in the background so it can bind to the port and reach CoinGecko:

```bash
npm run dev
```

Wait until the log shows `Ready` and `Local: http://localhost:3000`.

## Ready

The demo is up when both are true:

- `curl -sf -o /dev/null -w "%{http_code}" http://127.0.0.1:3000` prints `200`
- The response body contains `Welcome to TradeSim`

Report the commit `main` is on, whether the database was already in sync, and the URL `http://localhost:3000`.
