# NullVoid: Multi-Factor Authentication for Visually Impaired Users

A multi-factor authentication system that is strong on security and lets visually impaired users sign in independently, without reading or transcribing anything.

1. **First factor:** username and password (salted hash, rate-limited).
2. **Second factor:** the user picks one:
   - a **platform passkey** (WebAuthn), unlocked locally by fingerprint, face or device PIN, or
   - an **NFC FIDO2 security key**, which needs only a tap.

Screen-reader support, text-to-speech prompts, audio feedback and full keyboard navigation cover every step.

Full details are in [Project Proposal.md](Project%20Proposal.md).

## Prerequisites

- [Bun](https://bun.sh) **1.4.2 or newer** (check with `bun --version`). It is the runtime, package manager and test runner.
- A browser with WebAuthn support. `http://localhost` counts as a secure origin, so no TLS setup is needed.
- For the NFC path: an NFC-capable device and a FIDO2 security key.

## Getting started

```sh
bun install
bun start      # http://localhost:3000
bun run dev    # same, restarting on file changes
bun run test
```

Stack: Bun, Hono (server-rendered pages), SQLite (`bun:sqlite`), `@simplewebauthn`, [Oat](https://oat.ink) for UI. See [PLAN.md](PLAN.md).

## UI

Pages are styled by [Oat](https://oat.ink) (`@knadh/oat`), a classless library that styles semantic HTML (`<button>`, `<input>`, `<dialog>`, ...) and follows the system light/dark setting.

- It is self-hosted: `src/app.ts` serves the package from `node_modules` at `/static/oat/`, so no third-party script loads on an auth page.
- `Layout` (`src/views/layout.tsx`) loads `oat.min.css` and `oat.min.js` once, so every page gets them.
- Write plain semantic HTML and use Oat's attributes (`data-field`, `data-hint`, `role="alert" data-variant="error"`, `class="container"`) instead of custom classes.
- `public/css/style.css` loads after Oat and holds only the few overrides Oat lacks: container width, the dark background and the skip link. Keep it minimal.
- Oat is pre-v1 and may break between releases. Check its changelog before upgrading.

## Requirements

**Functional**

- Username and password as the first factor, verified against a salted hash.
- A required second factor: passkey or NFC FIDO2 key.
- At least one second factor enrolled before login can complete.
- Unique cryptographic challenge per login, verified against the registered public key.
- Screen-reader-compatible labels, prompts, controls and status messages.
- Rate limiting after repeated failed password attempts.
- A separate account-recovery mechanism for lost devices or keys.

**Non-functional**

- WCAG 2.2 AA, especially accessible authentication.
- Private keys stay in the authenticator and never reach the server. Credentials are origin-bound.
- The whole flow works with keyboard and screen reader only.

## Architecture

| Component             | Role                                                                             |
| :-------------------- | :------------------------------------------------------------------------------- |
| User                  | Interacts via TTS and a screen reader.                                           |
| Web / mobile app      | Accessible front end, talks to the backend over HTTPS.                           |
| Authentication server | Verifies the password and the second factor.                                     |
| Passkey (WebAuthn)    | Phishing-resistant credential held on the user's device.                         |
| NFC FIDO2 key         | Physical key, tapped against the device.                                         |
| Database              | Accounts, salted password hashes, public keys and credential IDs. No biometrics. |

## Authentication flow

1. The user enters username and password. Fields are labelled and announced, and there is no CAPTCHA.
2. On success, the user chooses **Passkey** or **NFC FIDO2 key**.
3. The server issues a challenge. The authenticator signs it, using local biometric or PIN for a passkey, or a tap for NFC.
4. The server verifies the signature against the stored public key and announces the result by audio.

## Security

| Threat                            | How it is addressed                                                 |
| :-------------------------------- | :------------------------------------------------------------------ |
| Phishing                          | Credentials are bound to the origin.                                |
| Brute force / credential stuffing | Rate limiting and lockout on passwords. No guessable second factor. |
| Database breach                   | Only salted hashes and public keys are stored.                      |
| OTP interception / SIM swap       | No SMS or e-mail codes are used.                                    |
| Man-in-the-middle                 | Private keys never leave the device or key.                         |
| Replay                            | Challenge-response with a unique challenge each time.               |

Voice authentication was considered and rejected because of noise, accent variation, replay and voice-cloning risks. Voice is used only for TTS prompts and audio feedback.

## Accessibility

- Screen-reader-compatible interface with meaningful labels.
- TTS instructions at each stage, for example "Please tap your security key near the NFC area".
- Logical keyboard tab order throughout.
- Audio feedback for success and failure.
- No visual-only steps.
- The user chooses between two second-factor methods.

**Testing:** screen readers across browsers, keyboard-only navigation, TTS and audio verification at every stage, and end-to-end runs with visually impaired users for both paths.

## Assumptions and constraints

- The user has a compatible device and has enrolled at least one second factor.
- An internet connection is available at login.
- Passkeys need a supporting platform and browser. NFC needs an NFC-capable device, and antenna location varies.
- Screen-reader and biometric behaviour varies across platforms.
- Audio prompts may not suit public or noisy places.
- A lost device or key needs a separate recovery path.
- A fully compromised device cannot be trusted.

## Authors

| Index No. | Team Member                                                                           |
| :-------- | :------------------------------------------------------------------------------------ |
| 230199V   | Genkeswaran N. ([nalinasai](https://github.com/nalinasai))                            |
| 230304R   | Jegarashan B. ([babijana](https://github.com/babijana))                               |
| 230345R   | Krishnaprashanth S. ([Krishnaprashanth-dev](https://github.com/Krishnaprashanth-dev)) |
| 230557T   | Sahithyan K. ([sahithyandev](https://github.com/sahithyandev))                        |
| 230667F   | Virusan T. ([virusan-t](https://github.com/virusan-t))                                |
