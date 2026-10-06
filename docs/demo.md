# NullVoid: demo script

## Before the demo

- [ ] `bun install`, delete `data/app.db`, `bun start`, open http://localhost:3000
- [ ] Browser and screen reader pair: _Day 4: decide (PLAN §6.2)_
- [ ] Platform authenticator ready (fingerprint, face or PIN)
- [ ] NFC key and an NFC-capable device charged and paired
- [ ] Volume up, text-to-speech toggle ready
- [ ] Recording running as a fallback

## Script

| # | Step | What to say | What the audience hears | Who | Time |
| --- | --- | --- | --- | --- | --- |
| 1 | Open `/register`, create an account with the keyboard only | No mouse, no sight needed | Field labels, status messages | | |
| 2 | Enrol a passkey on `/enrol` | The page says which website asks and what the device will do | Passkey prompt, success cue | | |
| 3 | Sign in with the password, choose Passkey | After the password nothing is typed or read | "Select an authentication method", "Please authenticate using your device", "Authentication successful" | | |
| 4 | Sign out, enrol an NFC key, sign in with a tap | Tap near the NFC area, the app never says where | "Please tap your security key near the NFC area", detection feedback | | |
| 5 | Fail a login on purpose | Wrong password 5 times | Specific lockout message with the wait time | | |
| 6 | Cancel or time out an NFC attempt | Clear message and a way back | Timeout message, link to `/second-factor` | | |
| 7 | Generate recovery codes, revoke the passkey, recover | Lost phone case | Codes shown once, recovery session limited to replacing credentials | | |
| 8 | Show `/account/devices` | Revoking ends other sessions, last credential protected | Rename and revoke announced | | |

## If something fails

- No NFC key or device: show the recorded NFC clip, or run the software
  authenticator (PLAN §5).
- Screen reader misbehaves: switch to the backup pair and mention it as a known
  limit (§7).
- _Day 4:_ add anything learned in the rehearsal.

## After

- _Day 4:_ questions asked, issues noticed, links to the recording.
