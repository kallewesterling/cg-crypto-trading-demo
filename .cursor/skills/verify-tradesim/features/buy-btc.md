# Buy BTC

Buy BTC spends cash from the signed-in wallet at the live Bitcoin price and records the trade.

## Sub-features

- `buy-open` shows the buy form on the dashboard.
- `buy-submit` spends USDT and adds BTC.
- `buy-percent` fills the pay field from the available cash.
- `buy-history` shows the new trade on the profile.

## How to get to it (user POV)

- Sign in and land on `/dashboard`.
- Choose `Dashboard` in the header.
- Choose the `TradeSim` wordmark, which also goes to `/dashboard`.

## Driving it with drive.mjs

Preconditions:

- `tradesim-verify.sh doctor --port 4173` prints `READY`.
- Signed in as `verify-user@example.com`. The wallet command shows `usdtBalance` `10000` and `btcBalance` `0`.
- The dashboard heading is `Welcome Back, Verify User!`, not `Could Not Load Dashboard`.
- The `Buy` tab is selected. The submit button reads `BUY BTC`.

- **Enter an amount.** Type `100` into the number input under the visible text `You Pay`. The amount field's accessible name is the placeholder `0.00`, so run `node .cursor/skills/verify-tradesim/scripts/drive.mjs --port 4173 fill --role textbox --name "0.00" --value "100"`. The read-only `You Receive` value becomes a positive BTC amount, and the field still shows the `USDT` suffix.
- **Submit the buy.** Choose `BUY BTC`. Run `node .cursor/skills/verify-tradesim/scripts/drive.mjs --port 4173 click --role button --name "BUY BTC"`, then wait for `Successfully bought`. The pay field clears.
- **Confirm balances.** Run `.cursor/skills/verify-tradesim/scripts/tradesim-verify.sh wallet verify-user@example.com --port 4173`. Cash is below `10000`, BTC is above `0`, and `trades` is `1`.
- **Open history.** Choose `Profile` in the header, or choose the `Total Trades` card. Run `node .cursor/skills/verify-tradesim/scripts/drive.mjs --port 4173 click --role link --name "Profile"`. The `Trade History` table contains a `BUY` row, and `Total Trades` on the profile is `1`.
- **Proof.** On the profile history, run `node .cursor/skills/verify-tradesim/scripts/drive.mjs --port 4173 snapshot --out .cursor/skills/verify-tradesim/artifacts/buy-btc/history.aria.txt` and `node .cursor/skills/verify-tradesim/scripts/drive.mjs --port 4173 screenshot --out .cursor/skills/verify-tradesim/artifacts/buy-btc/history.png`. Save the wallet stdout to `.cursor/skills/verify-tradesim/artifacts/buy-btc/wallet.txt`.

## Gotchas

- The `You Pay` label is not the input's accessible name. Target the number input that shows placeholder `0.00`.
- `25%`, `50%`, and `100%` replace the pay amount with a fraction of available USDT. `100%` on Sell uses the full BTC balance.
- The price comes from CoinGecko. Assert that cash went down and BTC went up, not a fixed BTC quantity.
- If the trade card shows `Price delayed` or `Price unavailable`, `BUY BTC` is disabled and this recipe cannot submit. Run `tradesim-verify.sh fault live --port 4173`, reload `/dashboard`, and wait until the chip is gone. Do not claim a buy while the button is disabled.
- A success toast without a wallet row is not proof. The trade must exist in sqlite and in `Trade History`.
- Sell is a separate action. This recipe only proves a buy. Selling with an empty BTC balance shows an insufficient-balance error.
