# NullVoid: manual test plan (proposal §8)

Automated tests: `bun run test`. This plan covers what they cannot: real
assistive technology, real authenticators and real people.

- Build under test (commit): _Day 4:_
- Date: _Day 4:_
- Lead tester: _Day 4:_

Result column: `pass`, `fail` (link the issue in Notes) or `n/a`. Blank means not run.

## Setups

| ID | OS | Browser | Screen reader | Device / authenticator | NFC key |
| --- | --- | --- | --- | --- | --- |
| S1 | macOS | Safari | VoiceOver | Touch ID | no |
| S2 | Windows | Firefox | NVDA | Windows Hello | no |
| S3 | Android | Chrome | TalkBack | Fingerprint or PIN | yes |
| S4 | any | any | none (keyboard only) | any | optional |

Demo pair: _to be confirmed (PLAN §6.2)_. The others are recorded as known
limits (§7).

## 1. Screen reader compatibility

| ID | Area | Steps | Expected | Setup | Result | Notes |
| --- | --- | --- | --- | --- | --- | --- |
| SR-1 | Register form | Open `/register`, move through the form | Username and password fields are announced with labels, the page has one heading, the skip link works | S1, S2, S3 | | |
| SR-2 | Login form | Open `/login`, submit empty and wrong values | Each field is labelled, errors are announced through the live region with a specific reason | S1, S2, S3 | | |
| SR-3 | Lockout message | Fail the password 5 times | Message says how long to wait and is announced | S1, S2 | | |
| SR-4 | Chooser | Sign in with a password, open `/second-factor` | "Select an authentication method" is announced, Passkey and NFC security key are links with clear names | S1, S2, S3 | | |
| SR-5 | Enrolment | Sign in with a new account, open `/enrol` | Same as SR-4 for enrolment | S1, S2, S3 | | |
| SR-6 | Passkey page | Open `/passkey/login` and `/passkey/register` | The page says which website is asking and what the device will do before the prompt | S1, S2, S3 | | |
| SR-7 | Security key page | Open `/security-key/login` and `/security-key/register` | Says the key may ask for its PIN | S1, S2, S3 | | |
| SR-8 | Account pages | Open `/account`, `/account/devices`, `/account/recovery-codes` | Landmarks, headings and device rows are readable, rename and revoke buttons name their device | S1, S2, S3 | | |
| SR-9 | Recovery codes | Generate a set | Codes are readable by the screen reader, shown once, never auto-spoken | S1, S2 | | |
| SR-10 | Status changes | Complete and fail a ceremony | Result is announced without moving focus away unexpectedly | S1, S2, S3 | | |

## 2. Keyboard only

| ID | Area | Steps | Expected | Setup | Result | Notes |
| --- | --- | --- | --- | --- | --- | --- |
| KB-1 | Register and login | Tab through and submit with Enter | Logical order, every control reachable, focus always visible | S4 | | |
| KB-2 | Chooser and enrol | Tab to each option and activate it | Both methods reachable and activated by keyboard | S4 | | |
| KB-3 | Passkey ceremony | Register and sign in with a passkey | Start button reachable, focus moves sensibly after the prompt closes | S4 | | |
| KB-4 | Security key ceremony | Register and sign in with a key | Same as KB-3, cancel is reachable | S4 | | |
| KB-5 | Devices | Rename and revoke a device | Both work without a mouse, no focus trap | S4 | | |
| KB-6 | Recovery | Use `/recover` and generate a new code set | Fully keyboard operable | S4 | | |
| KB-7 | Skip link | Press Tab once on any page | Skip link appears first and jumps to the main content | S4 | | |

## 3. Text-to-speech and audio at every stage

| ID | Stage | Steps | Expected | Setup | Result | Notes |
| --- | --- | --- | --- | --- | --- | --- |
| TA-1 | Toggle | Open any page | Text-to-speech is off by default, a visible toggle exists, the choice is remembered after reload | S1, S2, S3 | | |
| TA-2 | Password pages | Turn speech on, open `/register` and `/login` | Wording matches `docs/prompts.md` ("Please enter your username", "Please enter your password") | S1, S2, S3 | | |
| TA-3 | Chooser | Open `/second-factor` | "Select an authentication method" is spoken | S1, S2, S3 | | |
| TA-4 | Device prompt | Start a passkey or key ceremony | "Please authenticate using your device" is spoken | S1, S2, S3 | | |
| TA-5 | Success cue | Complete a login | Success cue plays and "Authentication successful" is spoken | S1, S2, S3 | | |
| TA-6 | Failure cue | Cancel or fail a ceremony | Failure cue plays and "Authentication failed. Please try again." is spoken | S1, S2, S3 | | |
| TA-7 | Secrets | Enter a password, a PIN prompt and generate recovery codes | Nothing secret is spoken aloud | S1, S2, S3 | | |
| TA-8 | Audio off | Mute or keep speech off, run the whole flow | The text and live region carry every message, nothing depends on audio | S1, S2, S3 | | |

## 4. End-to-end authentication

| ID | Path | Steps | Expected | Setup | Result | Notes |
| --- | --- | --- | --- | --- | --- | --- |
| E2E-1 | Passkey | Register, enrol a passkey, sign out, sign in with it | Reaches `/account`, only a screen reader and keyboard used | S1, S2, S3 | | |
| E2E-2 | Passkey refused | Cancel the device prompt, then use the wrong finger or PIN | A specific failure reason is announced and the user can retry | S1, S2, S3 | | |
| E2E-3 | NFC key | Enrol a security key, sign out, sign in by tapping | "Please tap your security key near the NFC area" is announced, detection or failure is announced, reaches `/account` | S3 | | |
| E2E-4 | NFC timeout and cancel | Start NFC sign-in and do nothing, then cancel | Timeout message appears, cancel works, the way back to `/second-factor` is offered | S3 | | |
| E2E-5 | No NFC | Open the security key page on a device without NFC or WebAuthn | Plain message and a link back to `/second-factor` | S1, S2 | | |
| E2E-6 | Lost phone | Revoke the passkey, then recover with password and a recovery code | Recovery session may only register a new credential and see the device list | S1, S2 | | |
| E2E-7 | Lost key | Revoke the security key and replace it | Old key refused, new key works | S3 | | |
| E2E-8 | Last credential | Revoke the only credential with and without recovery codes | Refused without codes, allowed with them | S1, S2 | | |
| E2E-9 | Other sessions | Sign in on two browsers and revoke a credential in one | The other session ends | S1, S2 | | |

## 5. Session with a visually impaired user (aim)

- Participant (initials or code only): _Day 4:_
- Consent for notes: _Day 4:_
- Their own screen reader, browser and device: _Day 4:_
- Tasks: create an account, enrol a passkey, sign in with it, enrol an NFC key,
  sign in with it. Facilitator gives no hints unless asked.

| Task | Completed alone? | Time | Problems seen | Quotes |
| --- | --- | --- | --- | --- |
| Create account | | | | |
| Passkey enrolment | | | | |
| Passkey login | | | | |
| NFC key enrolment | | | | |
| NFC key login | | | | |

Changes made because of this session: _Day 4:_

If no participant is available, say so in the report. Do not substitute a
sighted tester with the screen off and call it the same thing.

## Known limits (§7)

- Screen reader behaviour differs by operating system and browser.
- Not every device has biometrics or NFC.
- NFC antenna position differs by device, so the interface never tells the user
  where it is.
- Audio is not always suitable in public or noisy places.
- A fully compromised device cannot be trusted.
