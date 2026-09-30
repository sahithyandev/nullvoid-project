# NullVoid: implementation plan

Scope is exactly what [Project Proposal.md](Project%20Proposal.md) describes.
Section numbers below (e.g. §3.2) refer to it. Nothing outside the proposal is
built: no voice authentication (§6.8), no biometric matching (the OS does it),
no OIDC, no real email or SMS, no production deployment.

Target: 4 working days, 5 members (M1 to M5).

## 1. The setup

The project skeleton and the shared contract are done and on `main`. Setup and
commands are in [README.md](README.md).

**Stack.** Bun 1.4.2+, Hono with server-rendered `hono/jsx` pages (`.tsx`),
`bun:sqlite`, Argon2id through `Bun.password` (bcrypt is not used),
`@simplewebauthn/server` and `/browser`, plain `.js` browser scripts in
`public/js`. One project, no build step.

**What already exists**

| File | What it gives you |
| --- | --- |
| `src/app.ts` | Mounts each member's router. Prefixes are in the table below |
| `src/routes/*.ts` | One empty Hono router per member, in the file named in your task list |
| `src/config.ts` | RP name, RP ID, origin, session and challenge lifetimes |
| `src/db.ts`, `src/schema.sql` | Database opened on start-up, all tables in the one SQL file. Delete `data/app.db` to start over |
| `src/session.ts` | `getSession`, `startPasswordOk`, `completeLogin`, `startRecovery`, `endSession`, `endUserSessions` |
| `src/guards.ts` | `requirePasswordOk`, `requireFull`, `requireRecovery`, `requirePasswordOkOrRecovery`. They set `userId` and `sessionId` on the context. Use `new Hono<AppEnv>()` |
| `src/dev/fake-session.ts` | `fakeSession(state)` and `fakeUser()`: put a test request into any session state without the login pages |
| `src/views/layout.tsx`, `public/js/a11y.js`, `public/css/style.css` | Page shell stub and the three browser functions (M4 finishes them) |

**Session states:** `anonymous`, `password_ok` (password passed, second factor
pending), `full` (both passed), `recovery` (recovered with a code; may only
replace credentials). `completeLogin` works only from `password_ok`.

**Tables:** `users` (M1), `credentials` and `challenges` (M2 and M3 insert; M5
only sets `revoked_at`), `recovery_codes` (M5), `sessions` (shared). M2 writes
only `kind='passkey'` rows and M3 only `kind='security_key'`. Column names are
fixed; extra columns and indexes are fine, added in `src/schema.sql` (the
only shared file members may edit, one table each).

**URL map**, each prefix owned by one member:

| Prefix                     | Owner | Pages and endpoints                                                    |
| -------------------------- | ----- | ---------------------------------------------------------------------- |
| `/register`, `/login`      | M1    | account creation, password form                                        |
| `/passkey/*`               | M2    | `register/options`, `register/verify`, `login/options`, `login/verify` |
| `/security-key/*`          | M3    | same four endpoints                                                    |
| `/`, `/second-factor`, `/enrol`, `/account` | M4 | home, chooser page, enrolment chooser page, signed-in landing page |
| `/recover/*`, `/account/*` | M5    | recovery, device list, revoke                                          |

**Flow.** `/login` ends in `password_ok`. If the user has no active credential,
redirect to `/enrol`, otherwise to `/second-factor`. Both pages link to
`/passkey/...` or `/security-key/...` pages. Those call `completeLogin(c)` on
a successful login and redirect to `/account`. Registering a credential does
not sign the user in: after it succeeds, redirect to `/second-factor` so they
prove the new credential works by using it.

**Browser contract.** Import only these from `/static/js/a11y.js`:
`announce(text)` (writes to the `aria-live` region), `speak(text)`
(text-to-speech) and `feedback('success' | 'failure')` (audio cue). Wrap every
page in `<Layout title="...">`.

**How we stay independent.** Two members never edit the same file. Every
module is tested alone with `fakeSession`. WebAuthn modules are tested with a
software authenticator, so no hardware is needed until the final check. The
contract above changes only with the whole team's agreement. Each branch merges
into `main` without touching anyone else's files.

## 2. Members and tasks

### M1: Username, password, rate limiting (§3.1, §10)

Files: `src/password.ts`, `src/routes/login.ts`,
`src/attempts.ts`, `src/views/login.tsx`, `src/views/register.tsx`, tests.

1. Registration with username and password. Reject weak or empty passwords with
   a specific message.
2. Hash with Argon2id through `Bun.password`. Never log passwords.
3. Login: compare against the hash. Use the same message and a similar response
   time for an unknown user and a wrong password.
4. Rate limiting and temporary lockout after repeated failures, per account and
   per IP. A lockout message states how long to wait.
5. On success call `startPasswordOk()` and redirect to `/second-factor` or
   `/enrol`.
6. Tests: hash is not the password, lockout triggers and expires, unknown user
   and wrong password look the same.

Done when: a password login reaches `password_ok`, and failures lock the account.

### M2: Passkey second factor (§3.2)

Files: `src/routes/passkey.ts`, `public/js/passkey.js`,
`src/views/passkey-register.tsx`, `src/views/passkey-login.tsx`, tests.

1. Registration: `authenticatorAttachment: 'platform'`,
   `userVerification: 'required'`, `excludeCredentials` for the user's active
   passkeys. Store only the public key, credential ID and counter.
2. Login: `allowCredentials` from active passkeys only.
3. Every attempt uses a fresh challenge deleted before verification.
4. Verify challenge, origin, RP ID, signature and the UV flag (check the UV flag
   explicitly as well as through the library). Check the counter does not go
   backwards, allowing zero for synced passkeys.
5. Refuse a revoked credential even if the browser offers it.
6. Guards: registration uses `requirePasswordOkOrRecovery`, login uses
   `requirePasswordOk`. On a successful login call `completeLogin()`.
7. Before the device prompt, the page states in text which website is asking and
   what the device will do. Every outcome goes through `announce`, `speak` and
   `feedback`.
8. Tests with a software authenticator: happy path, replayed challenge,
   missing UV, wrong origin, revoked credential.

Done when: a passkey can be enrolled and used to complete login from a faked
`password_ok` session.

### M3: NFC FIDO2 security key second factor (§3.3, §6.5)

Files: `src/routes/security-key.ts`, `public/js/security-key.js`,
`src/views/security-key-register.tsx`, `src/views/security-key-login.tsx`, tests.

1. Same ceremony as M2 with `authenticatorAttachment: 'cross-platform'`, stored
   with `kind='security_key'`. Keep `transports` so `nfc` can be offered.
2. `userVerification: 'required'` (the key's PIN). Say in text that the key may
   ask for its PIN.
3. Guards and `completeLogin()` exactly as M2.
4. §6.5 instructions: "Please tap your security key near the NFC area", then
   feedback when the key is detected or authentication fails. Do not tell the
   user where the antenna is (§6.5). Add a timeout with a clear message, and a
   way to cancel.
5. Handle browsers or devices without NFC or WebAuthn: say so in plain text and
   point back to the chooser (§7, §9).
6. Tests with a software authenticator configured as a cross-platform key. One
   manual test with a real NFC key on the final day.

Done when: a security key can be enrolled and used from a faked `password_ok`
session, and the timeout and cancel messages work.

M2 and M3 have the same shape but share no code. A small amount of duplication
is accepted so that neither waits for the other.

### M4: Accessible interface and the chooser (§6.1-6.4, §6.6, §6.7)

Files: `src/views/layout.tsx`, `public/css/style.css`, `public/js/a11y.js`,
`src/views/second-factor.tsx`, `src/views/enrol.tsx`, `src/views/account.tsx`,
`src/views/error.tsx`, `src/routes/pages.tsx`, tests.

1. Finish `a11y.js`: `announce`, `speak`, `feedback`. Text-to-speech is optional,
   off by default, remembered by the browser, with a visible toggle (§7 says
   audio is not always suitable). Audio cues are generated with the Web Audio
   API, so no audio files are needed. Keep the three function signatures.
2. Finish the page shell: skip link, one `<h1>` per page, logical headings, an
   `aria-live="polite"` status region, visible focus, focus moved sensibly after
   each action, sufficient contrast. Keep the `Layout` props.
3. `/second-factor` and `/enrol`: the user chooses Passkey or NFC security key
   (§6.7). Prompts: "Select an authentication method", "Please authenticate
   using your device" (§6.2). Fully keyboard operable.
4. `/account`: signed-in landing page with links to M5's device list.
5. Text-to-speech wording for the login and password pages is provided as a
   plain list in `docs/prompts.md`, so M1 only has to call `speak`.
6. No CAPTCHA, no QR-only step, no image comparison. Do not auto-speak
   passwords, PINs or recovery codes.
7. Automated checks over every page: heading order, a label on every input,
   landmarks, contrast, a live region present. These run as a single test that
   walks all routes, so they also catch other members' pages.

Done when: the chooser works with a keyboard and a screen reader, and the page
check passes on all pages that exist.

### M5: Recovery, revocation, testing and documents (§7, §8, §10)

Files: `src/routes/account.ts`,
`src/routes/recover.ts`, `src/recovery-codes.ts`, `src/views/devices.tsx`,
`src/views/recover*.tsx`, `docs/`, tests.

1. Recovery codes: generated when the user asks for them, shown once, stored
   only as hashes, single use. A new set replaces the old one. Never log them.
2. Device list: shows every credential with its kind and label. The user can
   rename it and revoke it (sets `revoked_at`). Revoking also ends the user's
   other sessions (`endUserSessions`).
3. Refuse to revoke the last active credential unless the user has recovery
   codes (no lock-out trapdoor).
4. Recovery journey (lost phone or lost NFC key): username, password and one
   recovery code, then a `recovery` session (`startRecovery`). That session can
   only revoke the lost credential and enrol a replacement through M2 or M3's
   registration pages. It cannot do anything else. Recovery attempts are rate
   limited.
5. §8 testing: a manual test log in `docs/testing.md` with these categories:
   screen readers and browsers, keyboard only, text-to-speech and audio at every
   stage, the passkey path and the NFC path. Aim to include at least one
   session with a visually impaired user.
6. §10 threat table: `docs/threats.md` maps each row (stolen password, guessing,
   replay, phishing, lost phone, lost key, accessibility failure) to the test
   that proves it.
7. Final report and demo script.

Done when: a lost credential can be revoked and replaced from a `recovery`
session, and every threat row points to a test.

## 3. Schedule

| Day | Everyone                                                                                                       | Notes                                               |
| --- | -------------------------------------------------------------------------------------------------------------- | --------------------------------------------------- |
| 1   | M1 to M5 build their modules alone                                                                             | Push small commits to own branches, merge daily     |
| 2   | Finish modules with tests. M3 tries the real NFC key as early as possible                                      | Hardware surprises land here, not on the last day   |
| 3   | Integration: full flows on `main`. M4 runs the page check across all routes. Everyone fixes their own failures | First time all modules run together                 |
| 4   | M5 leads manual testing with a screen reader and a keyboard. Final report and demo                             | Freeze code at the start of the day, bug fixes only |

## 4. Checklist for every pull request

- No secrets in logs: passwords, recovery codes and PINs.
- Fresh single-use challenge, UV required, both checked on the server.
- Only public keys stored.
- Guard on every route that changes anything.
- Every status change goes through `announce`, `speak` and `feedback`, with a
  specific reason, never just "error".
- Keyboard only works on the new page.
- A test that fails if the security check is removed.

## 5. Risks

| Risk                                             | Handling                                                                                                |
| ------------------------------------------------ | ------------------------------------------------------------------------------------------------------- |
| Someone changes the contract                     | Contract changes need the whole team's agreement, in the group chat                                     |
| No NFC key or NFC-capable device                 | Confirm on Day 1 who owns one. Otherwise use the software authenticator and show NFC in a recorded demo |
| Screen reader behaviour differs by system        | Choose one browser and screen reader pair for the demo and record the others as known limits (§7)       |
| Integration bugs on Day 3                        | The fake-session helper and the shared contract tests should catch most earlier                         |
| Recovery mechanism not specified in the proposal | Recovery codes are our choice. Record it as an assumption in the report                                 |

## 6. Decisions to confirm before Day 1

1. Recovery mechanism: recovery codes plus password (proposed).
2. Demo browser and screen reader pair.
