# TradeSim verification map

This directory is the maintained source for verifying the user-facing behavior of TradeSim. Read the index before driving the app, then use the matching feature file as the recipe.

## Baseline preconditions

- Launch TradeSim with `.cursor/skills/verify-tradesim/scripts/tradesim-verify.sh launch --port 4173`.
- Each run gets its own sqlite file under `/tmp/tradesim-verify/run-<id>/dev.db`. Do not use `prisma/dev.db` or port 3000.
- Run `tradesim-verify.sh doctor --port 4173` and require the recorded pid, port, database, and landing text.
- Never drive an instance that was not started by this verification run.
- A fresh database has no users. Registration is the way to create the first account.

## Driving conventions

- Start every recipe from the baseline state unless its preconditions say otherwise.
- Prefer ARIA roles and accessible names over CSS selectors or DOM position.
- Drive the browser with `node .cursor/skills/verify-tradesim/scripts/drive.mjs --port 4173`.
- Start Chrome with `drive.mjs start` after doctor passes, and stop it with `drive.mjs stop` before server cleanup. Run `start` with the sandbox disabled. A seatbelt launch aborts Chrome and macOS shows "Google Chrome quit unexpectedly".
- Confirm mutations with `tradesim-verify.sh wallet <email> --port <port>`.
- Do not remove proof artifacts during cleanup.

## Proof and skip reporting

- Capture the user action and the resulting state, not only the final screen.
- UI proof includes an accessibility snapshot and a screenshot that show TradeSim.
- Mutation proof includes the wallet command output for the same email.
- Record the feature ID, entry point, URL, and port with every artifact.
- Report an unreachable path with the attempted command and the unmet precondition.
- Do not report a skipped entry point as verified through a different path.

## Feature entry contract

Each feature file starts with an H1 title and one paragraph describing the user-visible behavior. It then uses exactly four H2 sections in this order.

1. `Sub-features` lists short IDs with one line for each behavior.
2. `How to get to it (user POV)` lists every user entry point.
3. `Driving it with drive.mjs` starts with `Preconditions:` and uses labeled bullets that pair each user action with an exact command and observable result.
4. `Gotchas` lists traps that can waste or invalidate a verification run.

## Features

- [Landing](./landing.md) covers the public home page and its two entry links.
- [Register](./register.md) covers creating an account, validation, and the wallet row it writes.
- [Login](./login.md) covers email and password sign-in onto the dashboard.
- [Buy BTC](./buy-btc.md) covers a cash purchase from the dashboard and the updated balances.
- [Price delayed](./price-delayed.md) covers a CoinGecko miss that keeps the dashboard and pauses trading.
- [Profile](./profile.md) covers the performance report and trade history.
