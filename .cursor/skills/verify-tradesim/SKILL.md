---
name: verify-tradesim
description: Drive the TradeSim crypto trading demo in a browser and prove registration, login, BTC buys, and the profile report. Use when changing this app's UI, auth, wallet, or trades.
---

# Verify TradeSim

TradeSim is a Next.js demo at the repo root. A user registers, logs in, buys or sells BTC on the dashboard, and reads the profile report. Drive it with `drive.mjs` and the `tradesim-verify.sh` helper. The feature map in `features/` is the source of which paths count as verified.

The helper starts a disposable instance. It does not use port 3000 or `prisma/dev.db`. Those belong to the shared local demo. Two verification instances can run together when each has its own port and its own sqlite file under `/tmp/tradesim-verify`.

## Launch

From the repo root:

```bash
.cursor/skills/verify-tradesim/scripts/tradesim-verify.sh launch --port 4173
```

If 4173 is taken, pass another port other than 3000. The command creates `/tmp/tradesim-verify/run-<id>/`, runs `npx prisma db push` against `file:/tmp/tradesim-verify/run-<id>/dev.db`, and starts `npx next dev -p <port> -H 127.0.0.1` with a generated `AUTH_SECRET`, `DEV_LOGIN=true`, and `NEXT_PUBLIC_APP_URL` set to that origin.

Ready means `curl -sf http://127.0.0.1:<port>` contains `Welcome to TradeSim`, and the command printed `URL=`, `PID=`, and `DATABASE=`. The server log is `/tmp/tradesim-verify/run-<id>/server.log`.

## Doctor

Run this before driving, and again whenever the page looks wrong:

```bash
.cursor/skills/verify-tradesim/scripts/tradesim-verify.sh doctor --port 4173
```

It passes only when all of these are true:

- The state file `/tmp/tradesim-verify/4173.env` exists.
- The recorded pid is alive.
- That pid is the listener on the recorded port.
- The sqlite file exists.
- The origin returns the landing text `Welcome to TradeSim`.

Do not drive an instance that fails doctor. Do not attach Playwright to `http://localhost:3000` or any server this helper did not start.

## Drive

Drive the browser with `.cursor/skills/verify-tradesim/scripts/drive.mjs`. It launches headless system Chrome against the verification origin. Start it after doctor passes, and stop it before cleanup.

Run `drive.mjs start` with the sandbox disabled (Shell `required_permissions: ["all"]`, so `CURSOR_SANDBOX` is unset). A seatbelt launch aborts in macOS app registration and shows "Google Chrome quit unexpectedly". `start` exits before launching Chrome when `CURSOR_SANDBOX` is set. Later `drive.mjs` commands talk to the DevTools port and can run sandboxed.

```bash
node .cursor/skills/verify-tradesim/scripts/drive.mjs --port 4173 start
node .cursor/skills/verify-tradesim/scripts/drive.mjs --port 4173 goto /
node .cursor/skills/verify-tradesim/scripts/drive.mjs --port 4173 click --role link --name "Create Account"
node .cursor/skills/verify-tradesim/scripts/drive.mjs --port 4173 fill --role textbox --name "Email" --value "verify-user@example.com"
node .cursor/skills/verify-tradesim/scripts/drive.mjs --port 4173 wait --text "Welcome Back"
node .cursor/skills/verify-tradesim/scripts/drive.mjs --port 4173 snapshot --out .cursor/skills/verify-tradesim/artifacts/register/login.aria.txt
node .cursor/skills/verify-tradesim/scripts/drive.mjs --port 4173 screenshot --out .cursor/skills/verify-tradesim/artifacts/register/login.png
node .cursor/skills/verify-tradesim/scripts/drive.mjs --port 4173 stop
```

`click` follows links by URL and submits `type="submit"` buttons with `requestSubmit`, so React forms and Next routes both run. `fill` sets the textbox through the native value setter and dispatches `input`. `wait` polls visible text. Drive one feature file at a time from `features/`.

Stable handles:

- Landing heading: `Welcome to TradeSim`. Links: `Login`, `Create Account`.
- Register card text: `Create an Account`. Textboxes: `Name`, `Email`, `Password`. Submit button: `Create Account`. Alternate link: `Login`.
- Login card text: `Welcome Back`. Textboxes: `Email`, `Password`. Submit button: `Login`. When `DEV_LOGIN=true`, combobox accessible name `Test account`, button `Continue as this account`.
- Dashboard heading: `Welcome Back, <name>!`. Stat titles: `Portfolio Value`, `Total P&L`, `Live BTC Price`, `Total Trades`. Trade tabs: `Buy`, `Sell`. The trade card shows the BTC quote. Amount field: the number input under the visible label `You Pay` (placeholder `0.00`; the label is not wired to the input). Submit button: `BUY BTC` or `SELL BTC`. When the quote is delayed or missing, the card shows a `Price delayed` or `Price unavailable` chip, the quote text is muted, and the submit button is disabled. The pay field and percent buttons stay usable. A disabled control's accessibility snapshot ends with `disabled`.
- Header links on protected pages: `TradeSim`, `Dashboard`, `Profile`, button `Logout`.
- Profile heading: `Performance Report`. Section heading: `Trade History`.

Wait for the resulting text with `drive.mjs wait --text` instead of a fixed sleep. Registration and login success appear as a toast and a navigation. A toast alone is not proof.

CoinGecko is the live price boundary behind `/api/btc-price` and trade execution. Do not stub it on the buy path, and do not write a made-up price into the cache file. A failed quote no longer replaces the dashboard with `Could Not Load Dashboard`. The wallet, chart column, and trade form stay up. `Could Not Load Dashboard` means the wallet row itself failed to load.

The launch command points `BTC_PRICE_FAULT_FILE` at this run's `fault` file. `tradesim-verify.sh fault fail` pauses upstream fetches so the next request reuses the last good quote as `Price delayed`, or shows `Price unavailable` when the cache file is absent. `tradesim-verify.sh fault live` restores the feed. Trading stays paused until the quote is fresh again.

## Evidence

Save proof under `.cursor/skills/verify-tradesim/artifacts/<feature-id>/`. Capture the user action and the resulting state.

- Accessibility snapshot: `drive.mjs snapshot --out .cursor/skills/verify-tradesim/artifacts/<feature-id>/<step>.aria.txt`. The document title is `Crypto Trading Simulator`. Protected pages also show the `TradeSim` wordmark.
- Screenshot: `drive.mjs screenshot --out .cursor/skills/verify-tradesim/artifacts/<feature-id>/<step>.png`.
- Wallet or trade side effect: `.cursor/skills/verify-tradesim/scripts/tradesim-verify.sh wallet <email> --port <port>`. Save that stdout next to the screenshot. A new account has cash `10000` and BTC `0`. A buy decreases cash and increases BTC, and the trade count becomes `1`.

Record the feature id, entry point, URL, and port beside the artifacts. Do not mark a path verified because a different entry point worked.

## Cleanup

Stop Chrome first, then stop only the server pid this helper started:

```bash
node .cursor/skills/verify-tradesim/scripts/drive.mjs --port 4173 stop
.cursor/skills/verify-tradesim/scripts/tradesim-verify.sh cleanup --port 4173
```

`cleanup --all` stops every server recorded under `/tmp/tradesim-verify`. Cleanup deletes those run directories and state files. `drive.mjs stop` deletes that port's Chrome profile. Neither deletes `.cursor/skills/verify-tradesim/artifacts`. After cleanup, confirm the proof files are still there.

## Helpers

The helper is `.cursor/skills/verify-tradesim/scripts/tradesim-verify.sh`.

```bash
.cursor/skills/verify-tradesim/scripts/tradesim-verify.sh launch --port 4173
.cursor/skills/verify-tradesim/scripts/tradesim-verify.sh doctor --port 4173
.cursor/skills/verify-tradesim/scripts/tradesim-verify.sh wallet verify-user@example.com --port 4173
.cursor/skills/verify-tradesim/scripts/tradesim-verify.sh fault fail --port 4173
.cursor/skills/verify-tradesim/scripts/tradesim-verify.sh quote --port 4173
node .cursor/skills/verify-tradesim/scripts/drive.mjs --port 4173 stop
.cursor/skills/verify-tradesim/scripts/tradesim-verify.sh cleanup --port 4173
```
