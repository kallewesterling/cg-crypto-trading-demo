# Register

Register lets a visitor create a named account, then land on the login card. The new account stores a wallet with $10,000 cash and no BTC.

## Sub-features

- `register-open` opens a blank registration form.
- `register-save` creates the account and wallet.
- `register-duplicate` rejects an email that already exists.
- `register-invalid` keeps the user on the form when the password is too short.

## How to get to it (user POV)

- Choose `Create Account` on the landing page.
- Open `/register` directly.
- Choose `Register` on the login card.

## Driving it with drive.mjs

Preconditions:

- `tradesim-verify.sh doctor --port 4173` prints `READY`.
- The disposable database has no user named `verify-user@example.com`.
- Use name `Verify User`, email `verify-user@example.com`, and password `verify-pass`.

- **Landing entry.** From `http://127.0.0.1:4173/`, choose `Create Account`. Run `node .cursor/skills/verify-tradesim/scripts/drive.mjs --port 4173 goto /` and `node .cursor/skills/verify-tradesim/scripts/drive.mjs --port 4173 click --role link --name "Create Account"`. The card text is `Create an Account`, with textboxes `Name`, `Email`, and `Password`.
- **Enter the account.** Fill the three textboxes. Run `node .cursor/skills/verify-tradesim/scripts/drive.mjs --port 4173 fill --role textbox --name "Name" --value "Verify User"`, then the same command for `Email` / `verify-user@example.com` and `Password` / `verify-pass`. The `Create Account` button is enabled.
- **Submit.** Choose `Create Account`. Run `node .cursor/skills/verify-tradesim/scripts/drive.mjs --port 4173 click --role button --name "Create Account"`, then `node .cursor/skills/verify-tradesim/scripts/drive.mjs --port 4173 wait --text "Welcome Back"`. A toast reading `Account Created` may appear first; the login card is the result that counts.
- **Confirm the wallet.** Read the stored account. Run `.cursor/skills/verify-tradesim/scripts/tradesim-verify.sh wallet verify-user@example.com --port 4173`. The row shows name `Verify User`, `usdtBalance` `10000`, `btcBalance` `0`, and `trades` `0`.
- **Duplicate email.** Open `/register` again and submit the same email. The page stays on `/register` and reports that an account with this email already exists.
- **Invalid password.** Submit a new email with password `short`. The form stays put and the password field reports that the password must be at least 6 characters. No second wallet row appears.
- **Proof.** On the login card after the successful create, run `node .cursor/skills/verify-tradesim/scripts/drive.mjs --port 4173 snapshot --out .cursor/skills/verify-tradesim/artifacts/register/login.aria.txt` and `node .cursor/skills/verify-tradesim/scripts/drive.mjs --port 4173 screenshot --out .cursor/skills/verify-tradesim/artifacts/register/login.png`. Save the wallet command stdout to `.cursor/skills/verify-tradesim/artifacts/register/wallet.txt`. The snapshot title is `Crypto Trading Simulator`, the screenshot shows `Welcome Back` and `Account Created`, and the wallet file shows `verify-user@example.com`.

## Gotchas

- The success toast is not the proof. The login card and the wallet row are.
- Password minimum is 6 characters. Name minimum is 2 characters.
- Repeating the recipe against the same database hits the duplicate-email path. Launch a fresh instance, or use a new email and say so in the proof notes.
- Registration does not sign the user in. The next step is login.
