# Landing

Landing is the public home page. It introduces TradeSim and sends the user to login or registration.

## Sub-features

- `landing-open` shows the TradeSim introduction.
- `landing-login` opens the login card.
- `landing-register` opens the registration card.

## How to get to it (user POV)

- Open the verification origin, `http://127.0.0.1:4173/`.

## Driving it with drive.mjs

Preconditions:

- `tradesim-verify.sh doctor --port 4173` prints `READY`.
- The browser is aimed at the doctor URL, not port 3000.

- **Open home.** Navigate to `http://127.0.0.1:4173/`. Run `node .cursor/skills/verify-tradesim/scripts/drive.mjs --port 4173 goto /`. The heading reads `Welcome to TradeSim`, and the page offers links named `Login` and `Create Account`.
- **Login entry.** Choose `Login`. Run `node .cursor/skills/verify-tradesim/scripts/drive.mjs --port 4173 click --role link --name "Login"`. Wait for `Welcome Back`. The card text is `Welcome Back`.
- **Register entry.** Return home and choose `Create Account`. Run `node .cursor/skills/verify-tradesim/scripts/drive.mjs --port 4173 goto /`, then `node .cursor/skills/verify-tradesim/scripts/drive.mjs --port 4173 click --role link --name "Create Account"`. Wait for `Create an Account`.
- **Proof.** Capture the home page before leaving it. Run `node .cursor/skills/verify-tradesim/scripts/drive.mjs --port 4173 snapshot --out .cursor/skills/verify-tradesim/artifacts/landing/home.aria.txt` and `node .cursor/skills/verify-tradesim/scripts/drive.mjs --port 4173 screenshot --out .cursor/skills/verify-tradesim/artifacts/landing/home.png`. Both show `Welcome to TradeSim`. The document title is `Crypto Trading Simulator`.

## Gotchas

- Port 3000 is the shared demo. A landing page there is not this run.
- `Create an Account` and `Welcome Back` are card text, not headings.
- The home page does not require a database row. A doctor failure still means this instance is not safe to drive.
