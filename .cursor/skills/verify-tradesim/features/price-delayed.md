# Price delayed

A CoinGecko miss keeps the signed-in dashboard on screen. The last BTC quote stays visible with a Price delayed chip, and the buy and sell buttons stay off until a live quote returns.

## Sub-features

- `price-delayed` shows the last quote in muted text, a `Price delayed` chip, and a disabled `BUY BTC` button. The pay field still accepts an amount.
- `price-unavailable` shows `Price unavailable` and a disabled `BUY BTC` button when no quote has been cached. The heading stays `Welcome Back, Verify User!`.
- `price-hold` leaves the wallet unchanged while trading is paused.
- `price-recover` enables `BUY BTC` again after the feed is restored and CoinGecko answers.

## How to get to it (user POV)

- Sign in and land on `/dashboard`.
- Choose `Dashboard` in the header.

## Driving it with drive.mjs

Preconditions:

- `tradesim-verify.sh doctor --port 4173` prints `READY`.
- Signed in as `verify-user@example.com`. The wallet command shows `usdtBalance` `10000` and `btcBalance` `0`.
- The dashboard heading is `Welcome Back, Verify User!`.
- `tradesim-verify.sh fault live --port 4173` has been run, and a dashboard load has written a real quote. `tradesim-verify.sh quote --port 4173` prints JSON with a positive `usd`. Do not hand-write that file.

- **Pause the feed.** Run `.cursor/skills/verify-tradesim/scripts/tradesim-verify.sh fault fail --port 4173`. Then `node .cursor/skills/verify-tradesim/scripts/drive.mjs --port 4173 goto /dashboard` and `node .cursor/skills/verify-tradesim/scripts/drive.mjs --port 4173 wait --text "Price delayed"`. The trade card still shows a dollar quote, the pay field is usable, and `BUY BTC` is disabled.
- **Try the form.** Run `node .cursor/skills/verify-tradesim/scripts/drive.mjs --port 4173 fill --role textbox --name "0.00" --value "100"`. The `You Receive` value becomes a positive BTC amount. Do not click `BUY BTC`; the driver refuses a disabled button.
- **Confirm the wallet did not move.** Run `.cursor/skills/verify-tradesim/scripts/tradesim-verify.sh wallet verify-user@example.com --port 4173`. Cash is still `10000`, BTC is still `0`, and `trades` is `0`.
- **Proof.** On that delayed dashboard, run `node .cursor/skills/verify-tradesim/scripts/drive.mjs --port 4173 snapshot --out .cursor/skills/verify-tradesim/artifacts/price-delayed/delayed.aria.txt` and `node .cursor/skills/verify-tradesim/scripts/drive.mjs --port 4173 screenshot --out .cursor/skills/verify-tradesim/artifacts/price-delayed/delayed.png`. Save `tradesim-verify.sh quote --port 4173` to `.cursor/skills/verify-tradesim/artifacts/price-delayed/quote.txt` and the wallet stdout to `.cursor/skills/verify-tradesim/artifacts/price-delayed/wallet.txt`. The snapshot includes `Price delayed` and `button "BUY BTC" disabled`.
- **Drop the cache.** Run `.cursor/skills/verify-tradesim/scripts/tradesim-verify.sh quote clear --port 4173` while `fault` is still `fail`. Reload with `node .cursor/skills/verify-tradesim/scripts/drive.mjs --port 4173 goto /dashboard` and `node .cursor/skills/verify-tradesim/scripts/drive.mjs --port 4173 wait --text "Price unavailable"`. The heading is still `Welcome Back, Verify User!`, and `BUY BTC` is still disabled.
- **Restore the feed.** Run `.cursor/skills/verify-tradesim/scripts/tradesim-verify.sh fault live --port 4173`, then `node .cursor/skills/verify-tradesim/scripts/drive.mjs --port 4173 goto /dashboard`. When CoinGecko answers, the chip is gone and `BUY BTC` is enabled. If CoinGecko does not answer, stop on `Price unavailable` and do not claim recovery.

## Gotchas

- `fault fail` does not restart the server. The next `/api/btc-price` or dashboard render reads the flag.
- Deleting `btc-price.json` while the flag is `live` just fetches a new quote. Set `fail` first.
- The submit button's accessible name stays `BUY BTC` while it is disabled. The snapshot suffix `disabled` is the proof, not a renamed button.
- A success toast cannot appear on this path. Cash must stay `10000`.
- `Could Not Load Dashboard` is the missing-wallet screen. Seeing it here means this recipe failed.
- The chart may show its own `Price delayed` chip and must not collapse to an empty page. A skeleton is only the first paint for a range.
