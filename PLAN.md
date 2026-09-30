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

### Prerequisites that make every issue independent

An issue can start on day one, in any order, only if everything it needs from
another issue already exists. This work is done once, by the lead, **before the
issues are opened**:

1. **Software authenticator and credential helpers** in `src/dev/`. A test
   double that registers and signs in like a real authenticator (platform or
   cross-platform, with UV on or off), `fakeCredential(userId, kind)` that puts
   a ready credential row in the database, and `fakeUser(name, password)` that
   makes a user with a real Argon2id hash. Nobody builds their own.
2. **Endpoint contract** (below), so browser code and server code can be built
   separately.
3. **One file per issue.** Empty files for every issue exist and are already
   mounted (`passkey.ts` mounts `passkey-register.ts` and `passkey-login.ts`,
   `account.ts` mounts `recovery-codes.ts` and `devices.ts`), plus a stub
   `public/js/nfc-guidance.js` exporting `runWithNfcGuidance(action)`, which
   just runs `action()` until its issue fills it in. An issue edits only its own
   files, and its own table in `src/schema.sql` if it has one.
4. **Fixed test file names**, listed per issue, so documents can point at them.

**Endpoint contract**, the same for `passkey` and `security-key` (`kind`):

| Request | Response |
| --- | --- |
| `GET /{kind}/register`, `GET /{kind}/login` | the HTML page |
| `POST /{kind}/register/options` | SimpleWebAuthn `PublicKeyCredentialCreationOptionsJSON` |
| `POST /{kind}/register/verify` (body: the registration response JSON) | `200 {ok: true, redirect: "/second-factor"}` or `4xx {ok: false, reason}` |
| `POST /{kind}/login/options` | SimpleWebAuthn `PublicKeyCredentialRequestOptionsJSON` |
| `POST /{kind}/login/verify` (body: the authentication response JSON) | `200 {ok: true, redirect: "/account"}` or `4xx {ok: false, reason}` |

`reason` is one specific sentence that the browser passes to `announce`.

Rules that keep issues apart: pages only link to other members' URLs and never
call their code. Recovery has its own rate limiter, and a small amount of
duplication is accepted. Documents refer to tests by their fixed file names.
Integration on Day 3 and the manual testing on Day 4 are schedule work, not
issues.

## 2. Members and tasks

Each task is one GitHub issue and includes its own tests. A task is finished
when its code, its tests and its accessibility messages are done. Each member
owns one module, and the issues of a module go to that member. M1 is the
smallest module, so its owner has one issue where the others have two or three.

| Module | Member | GitHub |
| --- | --- | --- |
| M1 | Sahithyan K. | sahithyandev |
| M2 | Krishnaprashanth S. | Krishnaprashanth-dev |
| M3 | Virusan T. | virusan-t |
| M4 | Genkeswaran N. | nalinasai |
| M5 | Jegarashan B. | babijana |

### M1: Username, password, rate limiting (§3.1, §10)

1. **Password registration, login and lockout**
   - Files: `src/password.ts`, `src/attempts.ts`, `src/routes/login.ts`,
     `src/views/login.tsx`, `src/views/register.tsx`,
     `test/password.test.ts`.
   - Registration with username and password. Reject weak or empty passwords
     with a specific message.
   - Hash with Argon2id through `Bun.password`. Never log passwords.
   - Login compares against the hash. Use the same message and a similar
     response time for an unknown user and a wrong password.
   - Temporary lockout after repeated failures, per account and per IP. The
     lockout message states how long to wait.
   - On success call `startPasswordOk()` and redirect to `/second-factor`, or
     to `/enrol` if the user has no active credential (check the
     `credentials` table). Only the redirect is checked; the target pages are
     someone else's.
   - Tests: the stored hash is not the password, duplicate usernames and weak
     passwords are rejected, lockout triggers and expires, unknown user and
     wrong password look the same, a successful login reaches `password_ok`.

### M2: Passkey second factor (§3.2)

1. **Passkey registration (/passkey/register)**
   - Files: `src/routes/passkey-register.ts`, `public/js/passkey-register.js`,
     `src/views/passkey-register.tsx`, `test/passkey-register.test.ts`.
   - Follows the endpoint contract for `/passkey/register*`.
   - `authenticatorAttachment: 'platform'`, `userVerification: 'required'`,
     `excludeCredentials` for the user's active passkeys. Store only the public
     key, credential ID and counter, with `kind='passkey'`.
   - Fresh challenge per attempt, deleted before verification.
   - Guard: `requirePasswordOkOrRecovery`.
   - Before the device prompt, the page states in text which website is asking
     and what the device will do. Every outcome goes through `announce`,
     `speak` and `feedback`.
   - Tests with the software authenticator: happy path, replayed challenge,
     missing UV, wrong origin, duplicate authenticator.
2. **Passkey login (/passkey/login)**
   - Files: `src/routes/passkey-login.ts`, `public/js/passkey-login.js`,
     `src/views/passkey-login.tsx`, `test/passkey-login.test.ts`.
   - Follows the endpoint contract for `/passkey/login*`.
   - `allowCredentials` from active passkeys only. Refuse a revoked credential
     even if the browser offers it.
   - Verify challenge, origin, RP ID, signature and the UV flag (check the UV
     flag explicitly as well as through the library). Check the counter does
     not go backwards, allowing zero for synced passkeys.
   - Guard: `requirePasswordOk`. On success call `completeLogin()`.
   - Same text and audio messages as registration.
   - Tests use `fakeCredential`, not the registration code: happy path,
     replayed challenge, missing UV, wrong origin, revoked credential.

### M3: NFC FIDO2 security key second factor (§3.3, §6.5)

1. **Security key registration and login (/security-key)**
   - Files: `src/routes/security-key.ts`, `public/js/security-key.js`,
     `src/views/security-key-register.tsx`,
     `src/views/security-key-login.tsx`, `test/security-key.test.ts`.
   - Follows the endpoint contract for `/security-key/*`.
   - Same ceremony and checks as M2 with `authenticatorAttachment:
     'cross-platform'`, stored with `kind='security_key'`. Keep `transports`
     so `nfc` can be offered.
   - `userVerification: 'required'` (the key's PIN). Say in text that the key
     may ask for its PIN.
   - Guards, redirects and `completeLogin()` exactly as M2.
   - The browser script wraps each ceremony in `runWithNfcGuidance(action)`
     and shows the result with `announce`.
   - Tests with the software authenticator as a cross-platform key: happy path,
     replayed challenge, missing UV, revoked credential.
2. **NFC guidance module: prompts, timeout, cancel, unsupported devices**
   - Files: `public/js/nfc-guidance.js`, `test/nfc-guidance.test.ts`. Nothing
     else. Implements `runWithNfcGuidance(action)`.
   - §6.5 instructions: "Please tap your security key near the NFC area", then
     feedback when the key is detected or authentication fails. Do not tell the
     user where the antenna is.
   - A timeout with a clear message, and a way to cancel.
   - Browsers or devices without NFC or WebAuthn: say so in plain text and
     point back to `/second-factor` (§7, §9).
   - Tests use a fake `action`: the instruction is announced, a slow action
     times out, cancel works, an unsupported browser gets the plain message.
     One manual test with a real NFC key on the final day.

### M4: Accessible interface and the chooser (§6.1-6.4, §6.6, §6.7)

1. **Page shell, a11y.js and error page**
   - Files: `src/views/layout.tsx`, `src/views/error.tsx`,
     `public/css/style.css`, `public/js/a11y.js`, `test/layout.test.ts`.
   - Finish `a11y.js`: `announce`, `speak`, `feedback`. Text-to-speech is
     optional, off by default, remembered by the browser, with a visible toggle
     (§7 says audio is not always suitable). Audio cues use the Web Audio API,
     so no audio files are needed. Keep the three function signatures.
   - Finish the page shell: skip link, one `<h1>` per page, logical headings,
     an `aria-live="polite"` status region, visible focus, focus moved sensibly
     after each action, sufficient contrast. Keep the `Layout` props.
   - No CAPTCHA, no QR-only step, no image comparison. Do not auto-speak
     passwords, PINs or recovery codes.
   - Tests: the shell contains the skip link, one `<h1>` and the live region.
2. **Chooser, enrolment and account pages**
   - Files: `src/routes/pages.tsx`, `src/views/second-factor.tsx`,
     `src/views/enrol.tsx`, `src/views/account.tsx`, `docs/prompts.md`,
     `test/pages.test.ts`.
   - `/second-factor` and `/enrol`: the user chooses Passkey or NFC security
     key (§6.7) and each choice is a link to `/passkey/...` or
     `/security-key/...`. Prompts: "Select an authentication method", "Please
     authenticate using your device" (§6.2). Fully keyboard operable.
   - `/account`: signed-in landing page with links to `/account/devices` and
     `/account/recovery-codes`.
   - `docs/prompts.md`: the text-to-speech wording for the login and password
     pages as a plain list.
   - Tests: each page requires the right session state and renders its links.
3. **Route-walking accessibility test**
   - Files: `test/a11y-pages.test.ts` only.
   - Reads the list of registered routes from the app, requests every GET page
     with a fake session of the right state, and checks heading order, a label
     on every input, landmarks and the live region (with Bun's built-in
     `HTMLRewriter`). It checks whatever pages exist, so it passes with none
     and grows as pages arrive. A failure names the page and the rule, and its
     owner fixes the page.

### M5: Recovery, revocation, testing and documents (§7, §8, §10)

1. **Recovery codes and recovery journey (own rate limiter)**
   - Files: `src/recovery-codes.ts`, `src/recovery-limit.ts`,
     `src/routes/recover.ts`, `src/routes/recovery-codes.ts`,
     `src/views/recover*.tsx`, `src/views/recovery-codes.tsx`,
     `test/recovery.test.ts`.
   - Codes are generated at `/account/recovery-codes` when the user asks
     (`requireFull`), shown once, stored only as hashes, single use. A new set
     replaces the old one. Never log them.
   - Lost phone or lost NFC key: `/recover` takes username, password (checked
     directly against `users.password_hash`) and one recovery code, then starts
     a `recovery` session (`startRecovery`). That session can only reach the
     registration pages of M2 and M3 and the device list. Attempts are limited
     by its own limiter in `recovery-limit.ts`.
   - Tests with `fakeUser(name, password)`: a code works once, a new set
     invalidates the old one, wrong password or code is refused and limited, a
     `recovery` session cannot reach a `requireFull` route.
2. **Device list, rename and revoke**
   - Files: `src/routes/devices.ts`, `src/views/devices.tsx`,
     `test/devices.test.ts`.
   - `/account/devices` shows every credential with its kind and label. The
     user can rename it and revoke it (sets `revoked_at`). Revoking also ends
     the user's other sessions (`endUserSessions`).
   - Refuse to revoke the last active credential unless the user has unused
     rows in `recovery_codes` (no lock-out trapdoor).
   - Tests use `fakeCredential`: revoke sets `revoked_at`, other sessions end,
     the last credential is protected.
3. **Test plan, threat table and report skeleton**
   - Files: `docs/testing.md`, `docs/threats.md`, `docs/report.md`,
     `docs/demo.md`.
   - `docs/testing.md` (§8): the manual test plan as a table with a result
     column. Screen readers and browsers, keyboard only, text-to-speech and
     audio at every stage, the passkey path and the NFC path. Aim to include at
     least one session with a visually impaired user.
   - `docs/threats.md` (§10): each row (stolen password, guessing, replay,
     phishing, lost phone, lost key, accessibility failure) points to the fixed
     test file names listed in this plan.
   - `docs/report.md` and `docs/demo.md`: structure and the parts that do not
     depend on results. Results are filled in on Day 4.

## 3. Schedule

| Day | Everyone                                                                                                       | Notes                                               |
| --- | -------------------------------------------------------------------------------------------------------------- | --------------------------------------------------- |
| 0   | The lead builds the prerequisites (section 1), then opens the issues                                             | Nobody starts before this is merged                 |
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
