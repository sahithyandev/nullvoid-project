# NullVoid: threats and mitigations (proposal §10)

Each row points to the automated test files that fail if the mitigation is
removed, and to the manual tests in [testing.md](testing.md).

| Threat | Mitigation | Automated tests | Manual |
| --- | --- | --- | --- |
| Stolen password | A second factor is required. A correct password only reaches `password_ok`, and `completeLogin` works only after a verified passkey or security key | `test/password.test.ts` (a successful login reaches `password_ok`), `test/passkey-login.test.ts`, `test/security-key.test.ts` (session becomes `full` only after verification), `test/pages.test.ts` (pages need the right session state), `test/recovery.test.ts` (a recovery session cannot reach a `requireFull` route) | E2E-1, E2E-3 |
| Password guessing | Per-account and per-IP lockout with an Argon2id hash, same message and similar timing for unknown user and wrong password, a separate limiter on recovery | `test/password.test.ts` (lockout after 5 failures, unlock after 15 minutes, IP lockout, unknown user looks like wrong password), `test/recovery.test.ts` (attempts are limited per account, wrong password or code refused) | SR-3 |
| Replay | Fresh single-use challenge deleted before verification, counter must not go backwards | `test/passkey-register.test.ts`, `test/passkey-login.test.ts`, `test/security-key.test.ts` (replayed response, old and expired challenge, counter rollback refused) | none |
| Phishing | Credentials are bound to the origin and RP ID, user verification required | `test/passkey-register.test.ts`, `test/passkey-login.test.ts`, `test/security-key.test.ts` (wrong origin, wrong RP ID, missing user verification) | SR-6, SR-7 |
| Lost phone | Revoke the passkey, recover with password plus one single-use recovery code, revoking ends other sessions | `test/devices.test.ts` (revoke sets `revoked_at`, other sessions end, last credential protected), `test/recovery.test.ts` (a code works once, a new set invalidates the old one), `test/passkey-login.test.ts` (revoked passkey refused) | E2E-6, E2E-8, E2E-9 |
| Lost NFC key | Revoke the key and enrol a replacement | `test/devices.test.ts`, `test/recovery.test.ts`, `test/security-key.test.ts` (revoked security key refused) | E2E-7 |
| Accessibility failure | Shared page shell, route-walking page check, NFC guidance with timeout, cancel and fallback, manual testing with assistive technology | `test/layout.test.ts`, `test/pages.test.ts`, `test/a11y-pages.test.ts`, `test/nfc-guidance.test.ts` | SR-*, KB-*, TA-*, E2E-4, E2E-5, section 5 of testing.md |

## Out of scope

- A fully compromised user device (§7, §9).
- Voice authentication, not used because of noise, accents and voice cloning
  (§6.8). Voice is only used for prompts and feedback.
- SMS or email codes, which the design removes.
- Recovery codes are our own choice, because the proposal names no mechanism.
  Losing both the device and the recovery codes locks the account, and this is
  accepted.
