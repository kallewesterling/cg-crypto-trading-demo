# Login

Login signs an existing account in with email and password and opens the trading dashboard.

## Sub-features

- `login-open` shows the login card.
- `login-success` opens the dashboard for a valid account.
- `login-rejected` stays on the login card for a bad password.

## How to get to it (user POV)

- Choose `Login` on the landing page.
- Open `/login` directly.
- Arrive here after a successful registration.

## Driving it with drive.mjs

Preconditions:

- `tradesim-verify.sh doctor --port 4173` prints `READY`.
- `verify-user@example.com` already exists with password `verify-pass`. Create it with the register recipe first.
- The dashboard heading is `Welcome Back, Verify User!`. A missing CoinGecko quote does not replace that screen with `Could Not Load Dashboard`. That heading means the wallet row failed to load.

- **Open login.** From the landing page, choose `Login`. Run `node .cursor/skills/verify-tradesim/scripts/drive.mjs --port 4173 click --role link --name "Login"`. The card text is `Welcome Back`, with textboxes `Email` and `Password` and a button named `Login`.
- **Enter credentials.** Run `node .cursor/skills/verify-tradesim/scripts/drive.mjs --port 4173 fill --role textbox --name "Email" --value "verify-user@example.com"` and `node .cursor/skills/verify-tradesim/scripts/drive.mjs --port 4173 fill --role textbox --name "Password" --value "verify-pass"`.
- **Submit.** Choose `Login`. Run `node .cursor/skills/verify-tradesim/scripts/drive.mjs --port 4173 click --role button --name "Login"`, then `node .cursor/skills/verify-tradesim/scripts/drive.mjs --port 4173 wait --text "Welcome Back, Verify User!"`.
- **Bad password.** Sign out with the header button `Logout`, return to `/login`, and submit the same email with password `wrong-pass`. The card stays `Welcome Back` and a failure toast reports that login failed.
- **Proof.** On the signed-in dashboard, run `node .cursor/skills/verify-tradesim/scripts/drive.mjs --port 4173 snapshot --out .cursor/skills/verify-tradesim/artifacts/login/dashboard.aria.txt` and `node .cursor/skills/verify-tradesim/scripts/drive.mjs --port 4173 screenshot --out .cursor/skills/verify-tradesim/artifacts/login/dashboard.png`. Both show `Welcome Back, Verify User!` and `Portfolio Value`.

## Gotchas

- A development-only `Test account` picker appears because the helper sets `DEV_LOGIN=true`. This recipe uses the email and password form. Do not treat the picker as proof of password login.
- The helper also sets `AUTH_URL` to the verification origin. Without that, `Continue as this account` follows the repo `.env` and leaves this port.
- The picker lists accounts already in this instance's database. An empty database shows `No test accounts are in the local database yet.`
- Wrong-password and unknown-email failures look the same on the card: a login-failed toast, still on `/login`.
- The dashboard heading includes the account name. `Welcome Back` on the login card is a different screen.
