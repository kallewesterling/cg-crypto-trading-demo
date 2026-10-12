---
name: stop-tradesim
description: Stop the shared local TradeSim demo (Next.js on port 3000). Use when the user asks to stop TradeSim, shut down the demo, or stop the dev server for this repository.
---

# Stop TradeSim

Stop the shared local demo started by `.cursor/skills/start-tradesim`. Port 3000 belongs to that demo. The verification helper (`.cursor/skills/verify-tradesim`) is a different workflow: it uses another port and a disposable sqlite file. Do not stop it here.

SQLite is a file. There is no database server, Docker, or other process to stop. Leave `prisma/dev.db` and `.env` alone. Do not print values from `.env`.

## Find the server

From the repo root, see what is listening on port 3000:

```bash
lsof -nP -iTCP:3000 -sTCP:LISTEN
```

If nothing is listening, report that TradeSim is already stopped. Do not kill other processes.

## Confirm it is this demo

Stop the listener only when it is this repo's Next.js dev server (`npm run dev` or `next dev`, with its working directory in this repo).

If something else is listening on port 3000, stop and tell the user what it is. Do not kill it.

## Stop

Terminate the listener and, when the listener was started by it, the parent `npm run dev` process.

Wait until nothing is listening on port 3000. If those processes are still listening, report the PIDs and do not force-kill them.

## Done

TradeSim is stopped when `lsof -nP -iTCP:3000 -sTCP:LISTEN` prints nothing.

Report that the demo is stopped and that port 3000 is free.
