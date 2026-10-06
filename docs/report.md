# NullVoid: final report

Group NullVoid, Computer Security. Follows [Project Proposal.md](../Project%20Proposal.md).
Parts marked `_Day 4:_` are filled in after manual testing.

## 1. Summary

A multi-factor sign-in for visually impaired users. A username and password
come first, then the user picks a platform passkey or an NFC FIDO2 security
key. Every step works with a keyboard and a screen reader, with optional
text-to-speech and audio cues.

_Day 4:_ one-paragraph result of testing.

## 2. What was built

- Flow: `/register` or `/login`, then `/second-factor` (or `/enrol` when no
  credential exists), then `/passkey/*` or `/security-key/*`, then `/account`.
- Stack: Bun, Hono with server-rendered JSX, `bun:sqlite`, Argon2id through
  `Bun.password`, `@simplewebauthn`, Oat for styling, plain browser scripts.
- Session states: `anonymous`, `password_ok`, `full`, `recovery`.
- Not built, as in the proposal: voice authentication, biometric matching in
  the application, OIDC, email or SMS.

## 3. Requirements traceability

| Requirement (§1.3) | Where | Tests |
| --- | --- | --- |
| Username and password, salted hash | `src/password.ts`, `src/routes/login.ts` | `test/password.test.ts` |
| Second factor required | `src/session.ts`, `src/guards.ts` | `test/passkey-login.test.ts`, `test/security-key.test.ts` |
| Second-factor enrolment | `/enrol`, registration routes | `test/passkey-register.test.ts`, `test/security-key.test.ts`, `test/pages.test.ts` |
| Challenge-response | passkey and security-key routes | same four files |
| Accessible interface | `src/views/layout.tsx`, `public/js/a11y.js`, `public/js/nfc-guidance.js` | `test/layout.test.ts`, `test/pages.test.ts`, `test/a11y-pages.test.ts`, `test/nfc-guidance.test.ts` |
| Rate limiting | `src/attempts.ts` | `test/password.test.ts` |
| Account recovery | `src/recovery-codes.ts`, `src/recovery-limit.ts` | `test/recovery.test.ts`, `test/devices.test.ts` |
| WCAG 2.2 AA, keyboard and screen reader | all pages | [testing.md](testing.md) |

## 4. Security design

- Passwords: Argon2id, specific rejection of weak passwords, same message and
  similar time for unknown user and wrong password, lockout per account and IP.
- WebAuthn: fresh single-use challenge, origin and RP ID checked, user
  verification required and checked explicitly, counter must not go backwards
  (zero allowed for synced passkeys), only public keys stored.
- Recovery: single-use recovery codes stored as hashes, password also required,
  its own rate limiter, a recovery session can only replace credentials.
- Revocation: sets `revoked_at`, ends the user's other sessions, the last
  active credential is protected unless recovery codes exist.

## 5. Accessibility design as built

Follows proposal §6: labelled controls, skip link, one `h1` per page, live
region for every status, visible focus, optional text-to-speech (off by
default, remembered), Web Audio cues, NFC prompts with timeout, cancel and
fallback, no CAPTCHA or visual-only step, a real choice of method. Prompt
wording is in `docs/prompts.md`.

## 6. Assumptions and deviations

- Recovery mechanism is recovery codes plus password. The proposal names none.
- Text-to-speech is off by default because audio is not always suitable (§7).
- _Day 4:_ any other deviation found during integration.

## 7. Testing

### Automated

`bun run test`. _Day 4:_ paste the final pass count.

### Manual

Plan: [testing.md](testing.md). _Day 4:_ summary of results, failures found and
fixed, and the session with a visually impaired user (or why there was none).

## 8. Threats

See [threats.md](threats.md).

## 9. Known limits

Screen reader differences, NFC antenna position, devices without NFC, audio in
noisy places, compromised devices (§7). _Day 4:_ add what testing found.

## 10. Team

| Module | Member | Area |
| --- | --- | --- |
| M1 | Sahithyan K. | Username, password, rate limiting |
| M2 | Krishnaprashanth S. | Passkey |
| M3 | Virusan T. | NFC security key |
| M4 | Genkeswaran N. | Accessible interface, chooser |
| M5 | Jegarashan B. | Recovery, revocation, testing, documents |

## 11. References

1. Microsoft Learn, "Accessibility considerations for authentication methods".
2. LoginRadius, "Passkeys vs Passwords vs MFA Authentication".
3. WCAG 2.2, success criterion 3.3.8 Accessible Authentication.
