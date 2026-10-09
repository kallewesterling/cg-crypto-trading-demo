# Profile

Profile is the performance report for the signed-in account. It shows lifetime P&L, summary metrics, and trade history.

## Sub-features

- `profile-open` opens the report from the header or a dashboard stat.
- `profile-empty` explains that the chart needs two trades and that history is empty.
- `profile-history` lists trades newest first after a buy.

## How to get to it (user POV)

- Choose `Profile` in the header while signed in.
- Choose the `Total P&L` card on the dashboard.
- Choose the `Total Trades` card on the dashboard.
- Open `/profile` directly while signed in.

## Driving it with drive.mjs

Preconditions:

- `tradesim-verify.sh doctor --port 4173` prints `READY`.
- Signed in as `verify-user@example.com`.
- For `profile-empty`, the wallet command reports `trades` `0`. For `profile-history`, complete the buy recipe first.

- **Header entry.** Choose `Profile`. Run `node .cursor/skills/verify-tradesim/scripts/drive.mjs --port 4173 click --role link --name "Profile"`. The heading reads `Performance Report`.
- **Empty history.** With no trades, the page says `Make at least two trades to see your performance chart.` and the history table says `You haven't made any trades yet.` `Total Trades` is `0`.
- **Stat entry.** From the dashboard, choose the `Total Trades` card. The same report opens.
- **History after a buy.** After the buy recipe, `Trade History` shows one `BUY` row and `Total Trades` is `1`. The chart message remains, because one trade is not enough to draw it.
- **Proof.** Capture the report that matches the precondition you used. Run `node .cursor/skills/verify-tradesim/scripts/drive.mjs --port 4173 snapshot --out .cursor/skills/verify-tradesim/artifacts/profile/report.aria.txt` and `node .cursor/skills/verify-tradesim/scripts/drive.mjs --port 4173 screenshot --out .cursor/skills/verify-tradesim/artifacts/profile/report.png`.

## Gotchas

- `/profile` redirects to `/login` when no session exists. That redirect is not the report.
- Lifetime P&L is about zero after a buy at the current price. Do not require a large profit number.
- The chart appears only after two trades. One buy still leaves the two-trade message in place.
- Header `Profile` and the dashboard stat cards are different entry points. Verify the one you claim.
