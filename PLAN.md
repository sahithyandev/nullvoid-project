# NullVoid: implementation plan

Scope is exactly what [Project Proposal.md](Project%20Proposal.md) describes.
Section numbers below (e.g. §3.2) refer to it. Nothing outside the proposal is
planned.

Target: 4 working days, 5 members.

## 1. Scope

| Proposal item                                                                      | Built as                                            |
| ---------------------------------------------------------------------------------- | --------------------------------------------------- |
| §1.3.1 Username and password, salted hash                                          | Argon2id                                            |
| §1.3.1 Rate limiting on failed passwords, §10 lockout                              | Per-account and per-IP counter, temporary lockout   |
| §1.3.1 / §6.7 Second factor: passkey or NFC FIDO2 key, user chooses                | Two independent WebAuthn modules and a chooser page |
| §1.3.1 At least one second factor enrolled before login completes                  | Enforced at the end of first-factor login           |
| §1.3.1 Cryptographic challenge-response                                            | Fresh single-use challenge per attempt, UV required |
| §6.1-6.5 Screen reader, text-to-speech, keyboard, audio feedback, NFC instructions | Shared front-end layer                              |
| §6.6 No CAPTCHA / visual-only steps                                                | Rule for every page                                 |
| §1.3.1, §7, §10 Recovery, revocation of lost device or key                         | Recovery codes, credential revocation, replacement  |
| §8 Accessibility testing                                                           | Automated checks plus a manual test log             |
| §10 Threats and mitigations                                                        | Each row maps to a test                             |

Not built (proposal excludes or does not mention): voice authentication (§6.8),
biometric matching (done by the OS), OIDC, real email or SMS, production
deployment.

### Stack (fixed; the proposal does not choose one)

One project, backend and frontend together, no separate frontend app and no
build step.

| Part                            | Choice                                                                                                                       |
| ------------------------------- | ---------------------------------------------------------------------------------------------------------------------------- |
| Runtime, package manager, tests | Bun 1.4.2 or newer (`bun install`, `bun test`)                                                                               |
| Web framework                   | Hono, with the Bun adapter                                                                                                   |
| Pages                           | Server-rendered with `hono/jsx` (`.tsx` files). Plain HTML, no client framework                                              |
| Browser scripts                 | Plain `.js` files in `public/js`, served as static files                                                                     |
| Database                        | SQLite via the built-in `bun:sqlite`                                                                                         |
| Password hashing                | Argon2id via the built-in `Bun.password` (bcrypt is not used)                                                                |
| WebAuthn                        | `@simplewebauthn/server` (server) and `@simplewebauthn/browser` (browser)                                                    |
| Sessions                        | Our own: a random ID in an `HttpOnly`, `SameSite=Lax` cookie, state kept in a `sessions` table (Hono's `hono/cookie` helper) |
| Text-to-speech                  | The browser's built-in `speechSynthesis`                                                                                     |
| Language                        | TypeScript, run directly by Bun                                                                                              |

`bun start` runs it on `http://localhost:3000`, a secure origin for WebAuthn.
Dependencies stay at three packages: `hono`, `@simplewebauthn/server` and
`@simplewebauthn/browser`. Hono also runs on Node, so the runtime can be
swapped later if Bun causes problems.

## 2. How the work stays independent

Members do not wait on each other. Three rules make that true.

1. **A contract, frozen on Day 0.** The whole team spends about 3 hours
   writing the skeleton and the contract (section 3). After that, nobody
   changes it without telling everyone.
2. **Separate files per member.** Each member owns a router, its views, its
   browser scripts and its tests. Two members never edit the same file.
3. **Each module runs alone.** `src/dev/fake-session.ts` (written on Day 0)
   lets a member put a request into any session state, so nobody needs another
   member's login page to test their own. WebAuthn modules are tested with a
   software authenticator, so no hardware is needed until the final check.

Each member's branch merges into `main` without touching the others'.

## 3. Day 0: the contract (everyone, together)

Deliverables, all committed to `main` before splitting:

**a) Skeleton.** The project setup (`package.json`, `server.ts`, a bare
`src/app.ts`, `public/`, dependencies, one test) is already done. Still to add:
the mounting of each member's sub-app in `src/app.ts` under its own prefix,
`src/config.ts` (RP name, RP ID, origin), `src/db.ts` (opens the database and
runs every `src/schema/*.sql` file) and an empty `src/views/`. Each member's
routes live in one file that exports a Hono sub-app.

**b) Session states**, stored in the `sessions` table and read with
`getSession(c)`:

| State         | Meaning                                             | Set by            |
| ------------- | --------------------------------------------------- | ----------------- |
| `anonymous`   | nothing yet                                         | default           |
| `password_ok` | first factor passed, second factor pending          | password module   |
| `full`        | both factors passed                                 | `completeLogin()` |
| `recovery`    | recovered with a code; may only enrol a replacement | recovery module   |

`src/session.ts` exports, implemented on Day 0 and never changed:
`getSession(c)`, `startPasswordOk(c, userId)`, `completeLogin(c)`,
`startRecovery(c, userId)`, `endSession(c)` (`c` is the Hono context). Each
`start*` and `completeLogin` issues a new session ID and deletes the old one.
`src/guards.ts` exports the Hono middleware `requirePasswordOk`,
`requireFull`, `requireRecovery`, which also put `userId` on the context.

**c) Database tables**, one schema file per owner so files never collide:

| Table            | Owner                                      | Columns                                                                                                                                            |
| ---------------- | ------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------- |
| `sessions`       | Day 0                                      | `id`, `user_id`, `state`, `created_at`, `expires_at`                                                                                               |
| `users`          | M1                                         | `id`, `username` (unique), `password_hash`, `failed_count`, `locked_until`                                                                         |
| `credentials`    | M2 and M3 (insert), M5 (sets `revoked_at`) | `id`, `user_id`, `kind` (`passkey` or `security_key`), `credential_id`, `public_key`, `counter`, `transports`, `label`, `created_at`, `revoked_at` |
| `challenges`     | M2 and M3                                  | `id`, `user_id`, `kind`, `challenge`, `expires_at`                                                                                                 |
| `recovery_codes` | M5                                         | `id`, `user_id`, `code_hash`, `used_at`                                                                                                            |

M2 only ever writes rows with `kind='passkey'` and M3 only `kind='security_key'`.
Each ignores the other's rows.

**d) URL map**, each prefix owned by one member:

| Prefix                     | Owner | Pages and endpoints                                                    |
| -------------------------- | ----- | ---------------------------------------------------------------------- |
| `/register`, `/login`      | M1    | account creation, password form                                        |
| `/passkey/*`               | M2    | `register/options`, `register/verify`, `login/options`, `login/verify` |
| `/security-key/*`          | M3    | same four endpoints                                                    |
| `/second-factor`, `/enrol` | M4    | chooser page, enrolment chooser page                                   |
| `/recover/*`, `/account/*` | M5    | recovery, device list, revoke                                          |

Flow: `/login` ends in `password_ok`. If the user has no active credential,
redirect to `/enrol`, otherwise to `/second-factor`. Both pages link to
`/passkey/...` or `/security-key/...` pages. Each of those calls
`completeLogin(c)` on success, which redirects to `/account`.

**e) Browser contract** (`public/js/a11y.js`, written by M4 and stubbed on
Day 0 so others can call it before it is finished, together with a plain
`Layout` stub):
`announce(text)` writes to the `aria-live` region, `speak(text)` uses
text-to-speech, `feedback('success' | 'failure')` plays the audio cue. Every
other member calls only these three, and every page is wrapped in
the `Layout` component (`src/views/layout.tsx`) from M4, which contains the
header, skip link and status region.

**f) Shared rules**, copied from §6 and §1.3.2 into the top of this file's
checklist (section 6).

## 4. Members and tasks

### M1: Username, password, rate limiting (§3.1, §10)

Files: `src/schema/users.sql`, `src/password.ts`, `src/routes/login.ts`,
`src/attempts.ts`, `src/views/login.tsx`, `src/views/register.tsx`, tests.

1. Registration with username and password. Reject weak or empty passwords with
   a specific message.
2. Hash with Argon2id through `Bun.password` (salted, memory-hard), not bcrypt,
   for stronger resistance to GPU cracking. Never log passwords.
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
6. Guard: registration needs `password_ok` or `recovery`. Login needs
   `password_ok`. On success call `completeLogin()`.
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
`src/views/error.tsx`, `src/routes/pages.ts`, tests.

1. `a11y.js`: `announce`, `speak`, `feedback`. Text-to-speech is optional, off
   by default, remembered by the browser, with a visible toggle (§7 says audio
   is not always suitable). Audio cues are generated with the Web Audio API, so
   no audio files are needed.
2. Page shell: skip link, one `<h1>` per page, logical headings, an
   `aria-live="polite"` status region, visible focus, focus moved sensibly after
   each action, sufficient contrast.
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

Files: `src/schema/recovery.sql`, `src/routes/account.ts`,
`src/routes/recover.ts`, `src/recovery-codes.ts`, `src/views/devices.tsx`,
`src/views/recover*.tsx`, `docs/`, tests.

1. Recovery codes: generated when the user asks for them, shown once, stored
   only as hashes, single use. A new set replaces the old one. Never log them.
2. Device list: shows every credential with its kind and label. The user can
   rename it and revoke it (sets `revoked_at`). Revoking also ends any other
   session belonging to that user.
3. Refuse to revoke the last active credential unless the user has recovery
   codes (no lock-out trapdoor).
4. Recovery journey (lost phone or lost NFC key): username, password and one
   recovery code, then a `recovery` session. That session can only revoke the
   lost credential and enrol a replacement through M2 or M3's registration
   pages. It cannot do anything else. Recovery attempts are rate limited.
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

## 5. Schedule

| Day      | Everyone                                                                                                       | Notes                                               |
| -------- | -------------------------------------------------------------------------------------------------------------- | --------------------------------------------------- |
| 0 (half) | Contract and skeleton (section 3)                                                                              | Nobody starts a module until it merges              |
| 1        | M1 to M5 build their modules alone                                                                             | Push small commits to own branches, merge daily     |
| 2        | Finish modules with tests. M3 tries the real NFC key as early as possible                                      | Hardware surprises land here, not on the last day   |
| 3        | Integration: full flows on `main`. M4 runs the page check across all routes. Everyone fixes their own failures | First time all modules run together                 |
| 4        | M5 leads manual testing with a screen reader and a keyboard. Final report and demo                             | Freeze code at the start of the day, bug fixes only |

## 6. Checklist for every pull request

- No secrets in logs: passwords, recovery codes and PINs.
- Fresh single-use challenge, UV required, both checked on the server.
- Only public keys stored.
- Guard on every route that changes anything.
- Every status change goes through `announce`, `speak` and `feedback`, with a
  specific reason, never just "error".
- Keyboard only works on the new page.
- A test that fails if the security check is removed.

## 7. Risks

| Risk                                             | Handling                                                                                                |
| ------------------------------------------------ | ------------------------------------------------------------------------------------------------------- |
| Someone changes the contract after Day 0         | Contract changes need the whole team's agreement, in the group chat                                     |
| No NFC key or NFC-capable device                 | Confirm on Day 0 who owns one. Otherwise use the software authenticator and show NFC in a recorded demo |
| Screen reader behaviour differs by system        | Choose one browser and screen reader pair for the demo and record the others as known limits (§7)       |
| Integration bugs on Day 3                        | The fake-session helper and the shared contract tests should catch most earlier                         |
| Recovery mechanism not specified in the proposal | Recovery codes are our choice. Record it as an assumption in the report                                 |

## 8. Decisions to confirm on Day 0

1. Recovery mechanism: recovery codes plus password (proposed).
2. Demo browser and screen reader pair.
