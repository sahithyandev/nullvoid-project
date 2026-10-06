# NullVoid: Multi-Factor Authentication for Visually Impaired Users

A multi-factor authentication system that is strong on security and lets visually impaired users sign in independently, without reading or transcribing anything. Built for the Computer Security module by Group NullVoid.

**Problem.** Design and implement a multi-factor authentication system for visually impaired users. It must provide strong security while letting them authenticate without significant inconvenience.

**Solution.**

1. **First factor:** username and password (Argon2id hash, rate-limited).
2. **Second factor:** the user picks one:
   - a **platform passkey** (WebAuthn), unlocked locally by fingerprint, face or device PIN, or
   - an **NFC FIDO2 security key**, which needs only a tap.

Screen-reader support, optional text-to-speech prompts, audio feedback and full keyboard navigation cover every step. Both second factors were chosen because neither needs reading or typing.

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

| Variable  | Default                                     | Meaning                                                                                                                                |
| :-------- | :------------------------------------------ | :------------------------------------------------------------------------------------------------------------------------------------- |
| `ORIGIN`  | `http://localhost:3000`                     | Site origin. WebAuthn's expected origin and RP ID (the hostname) come from it, and cookies are `Secure` when it starts with `https://` |
| `DB_PATH` | `data/app.db` (`:memory:` under `bun test`) | SQLite file                                                                                                                            |

To start over, delete `data/app.db`. The schema is applied on every start.

Stack: Bun, Hono with server-rendered `hono/jsx` pages, `bun:sqlite`, Argon2id, `@simplewebauthn/server` and `/browser`, [Oat](https://oat.ink) for UI, plain `.js` browser scripts. One project, no build step.

## Requirements

**Functional**

- Username and password as the first factor, verified against a salted hash.
- A required second factor: passkey or NFC FIDO2 key.
- At least one second factor enrolled before login can complete.
- A unique cryptographic challenge per login, verified against the registered public key.
- Screen-reader-compatible labels, prompts, controls and status messages in enrolment and login.
- Rate limiting after repeated failed password attempts.
- A separate account-recovery mechanism for lost devices or keys.

**Non-functional**

- **Accessibility:** WCAG 2.2 AA, especially accessible authentication. Users never depend solely on reading or transcribing authentication information.
- **Security:** private keys stay in the authenticator and never reach the server. Credentials are bound to the registering origin, which protects against phishing and replay.
- **Usability:** the whole flow works with keyboard and screen reader only.

**Where each requirement lives**

| Requirement | Code | Tests |
| :--- | :--- | :--- |
| Username and password, salted hash | `src/password.ts`, `src/routes/login.ts` | `test/password.test.ts` |
| Second factor required | `src/session.ts`, `src/guards.ts` | `test/passkey-login.test.ts`, `test/security-key.test.ts` |
| Second-factor enrolment | `/enrol`, the registration routes | `test/passkey-register.test.ts`, `test/security-key.test.ts`, `test/pages.test.ts` |
| Challenge-response | `src/routes/passkey-*.ts`, `src/routes/security-key.ts` | `test/passkey-register.test.ts`, `test/passkey-login.test.ts`, `test/security-key.test.ts` |
| Accessible interface | `src/views/layout.tsx`, `public/js/a11y.js`, `public/js/nfc-guidance.js` | `test/layout.test.ts`, `test/pages.test.ts`, `test/nfc-guidance.test.ts` |
| Rate limiting | `src/attempts.ts` | `test/password.test.ts` |
| Account recovery | `src/recovery-codes.ts`, `src/recovery-limit.ts` | `test/recovery.test.ts`, `test/devices.test.ts` |
| WCAG 2.2 AA, keyboard and screen reader | all pages | manual plan in [`docs/testing.md`](docs/testing.md) |

## Architecture

| Component             | Role                                                                                                                                                      |
| :-------------------- | :-------------------------------------------------------------------------------------------------------------------------------------------------------- |
| User                  | Interacts via text-to-speech and a screen reader, so every element needs a proper label and logical focus order, without relying on colour or icon shape. |
| Web / mobile app      | Accessible front end, talks to the backend over HTTPS.                                                                                                    |
| Authentication server | Verifies the password and the second factor, and coordinates which factor is used.                                                                        |
| Passkey (WebAuthn)    | Phishing-resistant credential held on the user's device, unlocked by biometrics or a device PIN.                                                          |
| NFC FIDO2 key         | Physical key, tapped against the device. No screen interaction needed.                                                                                    |
| Database              | Accounts, password hashes, public keys and credential IDs. No biometrics.                                                                                 |

## Project layout

| Path                                             | Purpose                                                                                                                                      |
| :----------------------------------------------- | :------------------------------------------------------------------------------------------------------------------------------------------- |
| `server.ts`, `src/app.ts`                        | Entry point and the Hono app. `app.ts` mounts each router and serves static files, including Oat from `node_modules`                         |
| `src/config.ts`                                  | RP name, RP ID, origin, session and challenge lifetimes                                                                                      |
| `src/db.ts`, `src/schema.sql`                    | Database opened on start-up, every table in one SQL file                                                                                     |
| `src/session.ts`                                 | `getSession`, `startPasswordOk`, `completeLogin`, `startRecovery`, `endSession`, `endUserSessions`                                           |
| `src/guards.ts`                                  | `requirePasswordOk`, `requireFull`, `requireRecovery`, `requirePasswordOkOrRecovery`                                                         |
| `src/password.ts`, `src/attempts.ts`             | Password rules and hashing, the login lockout                                                                                                |
| `src/recovery-codes.ts`, `src/recovery-limit.ts` | Recovery code generation and check, the separate recovery limiter                                                                            |
| `src/routes/`                                    | One router per area: `login`, `passkey` (`-register`, `-login`), `security-key`, `pages`, `account` (`recovery-codes`, `devices`), `recover` |
| `src/views/`                                     | Server-rendered `.tsx` pages and the `Layout` shell                                                                                          |
| `public/js/`                                     | Browser scripts: `a11y.js`, `passkey-*.js`, `security-key.js`, `nfc-guidance.js`                                                             |
| `public/css/style.css`                           | The few overrides Oat lacks                                                                                                                  |
| `src/dev/`                                       | Test helpers: software authenticator, `fakeSession`, `fakeUser`, `fakeCredential`                                                            |
| `test/`, `src/*.test.ts`                         | Automated tests                                                                                                                              |
| `docs/`                                          | Manual test plan and threat table                                                                                     |

## Authentication flow

1. The user enters username and password. Fields are labelled and announced, and there is no CAPTCHA. The server hashes the submitted password and compares it with the stored hash. A match only allows the user to continue, because both factors are required.
2. If the user has no active credential they are sent to `/enrol`, otherwise to `/second-factor`. Either page lets them choose **Passkey** or **NFC security key**.
3. The server issues a unique challenge.
   - **Passkey:** the device generated the key pair at enrolment, so the private key never leaves its secure hardware (TPM, Secure Enclave or equivalent). The user unlocks it locally with fingerprint, face or PIN, and it signs the challenge.
   - **NFC key:** the user taps the key. NFC carries the traffic and FIDO2/WebAuthn does the cryptography. The key signs the challenge with its protected private key.
4. The server verifies the signature against the stored public key, completes the login, announces the result by audio, and redirects to `/account`.

Registering a credential does not sign the user in. After it succeeds they are redirected to `/second-factor` so they prove the new credential works by using it.

We use a platform passkey instead of a custom fingerprint matcher because the operating system already verifies biometrics securely. The app never captures, stores or processes biometric data.

**Recovery.** A user who loses a device or key signs in at `/recover` with username, password and one recovery code. That starts a limited session that can only register new credentials and manage the device list.

## Sessions and guards

| State         | Meaning                                             | Lifetime   |
| :------------ | :-------------------------------------------------- | :--------- |
| `anonymous`   | No session                                          | n/a        |
| `password_ok` | Password passed, second factor pending              | 10 minutes |
| `full`        | Both factors passed                                 | 8 hours    |
| `recovery`    | Recovered with a code, may only replace credentials | 15 minutes |

`completeLogin` works only from `password_ok`. Guards set `userId` and `sessionId` on the Hono context. A `recovery` session cannot reach a `requireFull` route.

## Routes

| Prefix                                | Pages and endpoints                                        | Guard                                                                 |
| :------------------------------------ | :--------------------------------------------------------- | :-------------------------------------------------------------------- |
| `/`                                   | Home with sign-up, sign-in and recovery paths              | none                                                                  |
| `/register`, `/login`, `POST /logout` | Account creation, password form, sign out                  | none                                                                  |
| `/second-factor`                      | Choose Passkey or NFC key                                  | `password_ok`                                                         |
| `/enrol`                              | Choose which factor to enrol                               | `password_ok` or `recovery`                                           |
| `/passkey/*`, `/security-key/*`       | Registration and login pages plus four JSON endpoints each | `password_ok` for login, `password_ok` or `recovery` for registration |
| `/account`                            | Signed-in landing page                                     | `full`                                                                |
| `/account/devices`                    | List, rename and revoke credentials                        | `full` or `recovery`                                                  |
| `/account/recovery-codes`             | Generate a new set, shown once                             | `full`                                                                |
| `/recover`                            | Start a recovery session                                   | none (own rate limiter)                                               |

**WebAuthn endpoint contract**, identical for `passkey` and `security-key` (`kind`):

| Request                                     | Response                                                                  |
| :------------------------------------------ | :------------------------------------------------------------------------ |
| `GET /{kind}/register`, `GET /{kind}/login` | The HTML page                                                             |
| `POST /{kind}/register/options`             | SimpleWebAuthn `PublicKeyCredentialCreationOptionsJSON`                   |
| `POST /{kind}/register/verify`              | `200 {ok: true, redirect: "/second-factor"}` or `4xx {ok: false, reason}` |
| `POST /{kind}/login/options`                | SimpleWebAuthn `PublicKeyCredentialRequestOptionsJSON`                    |
| `POST /{kind}/login/verify`                 | `200 {ok: true, redirect: "/account"}` or `4xx {ok: false, reason}`       |

`reason` is one specific sentence that the browser passes to `announce`, never just "error".

## Database

SQLite through `bun:sqlite`, defined in `src/schema.sql`.

| Table            | Holds                                                                                                     |
| :--------------- | :-------------------------------------------------------------------------------------------------------- |
| `users`          | Username, Argon2id hash, lockout counters                                                                 |
| `sessions`       | Session id, user, state, expiry                                                                           |
| `credentials`    | `kind` (`passkey` or `security_key`), credential ID, public key, counter, transports, label, `revoked_at` |
| `challenges`     | Single-use challenges per user and kind, with expiry. A row is deleted before it is verified              |
| `recovery_codes` | Code hashes with `used_at`. Plain codes are never stored or logged                                        |

Only password hashes and public keys are stored. Biometric data never reaches the server.

## Browser contract

Pages import only these from `/static/js/a11y.js`:

- `announce(text)` writes to the `aria-live` region.
- `speak(text)` text-to-speech. It is optional, off by default, remembered by the browser and has a visible toggle, since audio is not always suitable.
- `feedback('success' | 'failure')` plays an audio cue through the Web Audio API, so no audio files are shipped.

Every status change goes through all three with a specific reason. Passwords, PINs and recovery codes are never spoken automatically. Every page is wrapped in `<Layout title="...">`.

## UI

Pages are styled by [Oat](https://oat.ink) (`@knadh/oat`), a classless library that styles semantic HTML (`<button>`, `<input>`, `<dialog>`, ...) and follows the system light/dark setting.

- It is self-hosted: `src/app.ts` serves the package from `node_modules` at `/static/oat/`, so no third-party script loads on an auth page.
- `Layout` (`src/views/layout.tsx`) loads `oat.min.css` and `oat.min.js` once, so every page gets them.
- Write plain semantic HTML and use Oat's attributes (`data-field`, `data-hint`, `role="alert" data-variant="error"`, `class="container"`) instead of custom classes.
- `public/css/style.css` loads after Oat and holds only the few overrides Oat lacks: container width, the dark background and the skip link. Keep it minimal.
- Oat is pre-v1 and may break between releases. Check its changelog before upgrading.

## Security

| Threat                                 | How it is addressed                                                                                 |
| :------------------------------------- | :-------------------------------------------------------------------------------------------------- |
| Phishing                               | Credentials are bound to the origin and RP ID, and user verification is required.                   |
| Stolen password                        | A second factor is required. A correct password only reaches `password_ok`.                         |
| Password guessing, credential stuffing | Argon2id, lockout per account and per IP, no guessable second factor. Recovery has its own limiter. |
| Database breach                        | Only password hashes and public keys are stored, so there is no reusable second-factor secret.      |
| OTP interception, SIM swap             | No SMS or e-mail codes are used.                                                                    |
| Man-in-the-middle                      | Private keys never leave the device or key.                                                         |
| Replay                                 | Fresh single-use challenge per attempt, signature counter checked.                                  |
| Lost phone                             | Revoke the passkey, recover with password plus a recovery code. Revoking ends other sessions.       |
| Lost NFC key                           | Revoke the key and enrol a replacement.                                                             |
| Accessibility failure                  | Shared page shell, NFC guidance, and screen-reader and keyboard testing.                            |

**Compared with other approaches**

- **Passwords alone:** no shared secret to steal, guess or reuse, and no typing.
- **SMS / e-mail OTP:** immune to SIM swap and interception, and nobody can overhear a spoken code.
- **TOTP apps:** no six-digit code to read and retype with a screen reader, and no real-time phishing relay.
- **Knowledge-based recovery:** nothing guessable or researchable. Recovery codes are random.
- **Biometric-only without a hardware root:** keys are hardware-backed, so a compromised OS generally cannot extract them.

**Voice authentication** was considered and rejected because of background noise, accents, changes in the user's voice, replay and voice-cloning attacks. Voice is used only for text-to-speech prompts and audio feedback.

## Accessibility

- Screen-reader-compatible interface with meaningful labels on inputs, buttons, instructions, options and errors.
- Text-to-speech instructions at each stage, for example "Please enter your username", "Select an authentication method", "Please authenticate using your device".
- Logical keyboard tab order across the username field, password field, login button and second-factor options.
- Audio feedback: "Authentication successful" or "Authentication failed. Please try again."
- NFC antenna positions differ between devices, so the interface never asks the user to find one. It guides by instructions and feedback only.
- No CAPTCHA, image comparison, QR-only step or other visual-only step.
- The user chooses between two second-factor methods, whichever suits their device.

**Constraints**

- Screen-reader behaviour varies across operating systems, browsers and assistive technology.
- Not every device supports the same biometric or NFC capabilities.
- Audio prompts may not suit public or noisy places, hence the text-to-speech toggle.
- A lost device or NFC key needs a separate recovery path.
- A fully compromised device cannot be trusted whatever accessibility is provided.

**Testing.** Screen readers across browsers, keyboard-only navigation, text-to-speech and audio checks at every stage, and end-to-end runs with visually impaired users for both paths. The plan, setups and result columns are in [`docs/testing.md`](docs/testing.md). Threats map to test files in [`docs/threats.md`](docs/threats.md).

## Assumptions and constraints

- The user has a compatible device and has enrolled at least one second factor before any login.
- An internet connection is available at login, and the device's OS supports biometrics where that path is used.
- Passkeys need a supporting platform and browser. NFC needs an NFC-capable device.
- Recovery codes are our own choice because the design names no mechanism. Losing both the device and the recovery codes locks the account, and this is accepted.

## Development and testing

`bun run test` runs `bun test ./src ./test`. Tests need no hardware:

- `src/dev/authenticator.ts` is a software authenticator that registers and signs in like a real one (platform or cross-platform, user verification on or off).
- `fakeSession(state)` puts a request into any session state without the login pages.
- `fakeUser(name, password)` creates a user with a real Argon2id hash, and `fakeCredential(userId, kind)` inserts a ready credential row.

Checklist for changes:

- No secrets in logs: passwords, recovery codes, PINs.
- Challenge is fresh and single use, user verification is required, both checked on the server.
- Only public keys are stored.
- Every route that changes state has a guard.
- Every status change goes through `announce`, `speak` and `feedback`.
- The new page works with the keyboard only.
- A test fails if the security check is removed.

## Team

| Index No. | Team Member                                                                           | Area                                                                  |
| :-------- | :------------------------------------------------------------------------------------ | :-------------------------------------------------------------------- |
| 230199V   | Genkeswaran N. ([nalinasai](https://github.com/nalinasai))                            | Accessible interface, chooser, enrolment and account pages            |
| 230304R   | Jegarashan B. ([babijana](https://github.com/babijana))                               | Recovery codes, device list and revocation, test documents |
| 230345R   | Krishnaprashanth S. ([Krishnaprashanth-dev](https://github.com/Krishnaprashanth-dev)) | Passkey second factor                                                 |
| 230557T   | Sahithyan K. ([sahithyandev](https://github.com/sahithyandev))                        | Username, password and rate limiting                                  |
| 230667F   | Virusan T. ([virusan-t](https://github.com/virusan-t))                                | NFC security key and NFC guidance                                     |

## References

1. Microsoft Learn. "Accessibility considerations for authentication methods." <https://learn.microsoft.com/en-us/entra/identity/authentication/accessibility/authentication-methods-accessibility>
2. LoginRadius. "Passkeys vs Passwords vs MFA Authentication." <https://www.loginradius.com/blog/identity/passkeys-vs-passwords-vs-mfa-authentication>
3. W3C. WCAG 2.2, success criterion 3.3.8 Accessible Authentication.
