// Owner: M2. Routes: /passkey/login*. Mounted by src/routes/passkey.ts.
import { Hono } from "hono";
import { generateAuthenticationOptions, verifyAuthenticationResponse, type AuthenticationResponseJSON } from "@simplewebauthn/server";
import { config } from "../config";
import { db } from "../db";
import { requirePasswordOk, type AppEnv } from "../guards";
import { completeLogin } from "../session";

const app = new Hono<AppEnv>();
app.use("/login/*", requirePasswordOk);

const EXPIRED = "This request has expired or was already used. Please start again.";
const WRONG_SITE = "This response came from a different website, so it was refused.";
const NO_UV = "Your device did not confirm it was you with a fingerprint, face or screen lock. Please try again.";
const UNVERIFIED = "Your device's response could not be verified. Please try again.";
const NO_PASSKEY = "You have no active passkey. Please choose another method.";
const REVOKED = "This passkey is not active on your account. Please choose another method.";
const CLONED = "This passkey's sign-in count went backwards, so it was refused.";

app.post("/login/options", async (c) => {
  const userId = c.get("userId");
  const active = db
    .query<{ credential_id: string; transports: string | null }, [number]>(
      "SELECT credential_id, transports FROM credentials WHERE user_id = ? AND kind = 'passkey' AND revoked_at IS NULL",
    )
    .all(userId);
  if (active.length === 0) return c.json({ ok: false, reason: NO_PASSKEY }, 400);

  const options = await generateAuthenticationOptions({
    rpID: config.rpID,
    userVerification: "required",
    allowCredentials: active.map((r) => ({ id: r.credential_id, transports: r.transports ? JSON.parse(r.transports) : undefined })),
  });

  // One open challenge per user, so every attempt starts fresh.
  db.query("DELETE FROM challenges WHERE user_id = ? AND kind = 'passkey'").run(userId);
  db.query("INSERT INTO challenges (user_id, kind, challenge, expires_at) VALUES (?, 'passkey', ?, ?)").run(
    userId, options.challenge, Date.now() + config.challengeTtlMs,
  );
  return c.json(options);
});

app.post("/login/verify", async (c) => {
  const userId = c.get("userId");
  const fail = (reason: string) => c.json({ ok: false, reason }, 400);

  let body: AuthenticationResponseJSON;
  try {
    body = await c.req.json();
  } catch {
    return fail(UNVERIFIED);
  }

  // Deleted before it is checked, so a challenge can never be tried twice.
  const row = db
    .query<{ challenge: string; expires_at: number }, [number]>("DELETE FROM challenges WHERE user_id = ? AND kind = 'passkey' RETURNING challenge, expires_at")
    .get(userId);
  if (!row || row.expires_at <= Date.now()) return fail(EXPIRED);

  // Only this user's active passkeys: a revoked credential is refused even if the browser offers it.
  const stored = db
    .query<{ id: number; credential_id: string; public_key: Uint8Array; counter: number }, [unknown, number]>(
      "SELECT id, credential_id, public_key, counter FROM credentials WHERE credential_id = ? AND user_id = ? AND kind = 'passkey' AND revoked_at IS NULL",
    )
    .get(typeof body?.id === "string" ? body.id : null, userId);
  if (!stored) return fail(REVOKED);

  let info;
  try {
    const result = await verifyAuthenticationResponse({
      response: body,
      expectedChallenge: row.challenge,
      expectedOrigin: config.origin,
      expectedRPID: config.rpID,
      credential: { id: stored.credential_id, publicKey: stored.public_key, counter: stored.counter },
      requireUserVerification: true,
    });
    info = result.verified ? result.authenticationInfo : undefined;
  } catch (e) {
    const message = e instanceof Error ? e.message : "";
    return fail(/origin|RP ID/i.test(message) ? WRONG_SITE : /user verif/i.test(message) ? NO_UV : /counter/i.test(message) ? CLONED : UNVERIFIED);
  }
  if (!info) return fail(UNVERIFIED);
  if (!info.userVerified) return fail(NO_UV);
  // The counter must go up. Synced passkeys always report 0, so 0 after 0 is allowed.
  if (info.newCounter <= stored.counter && !(info.newCounter === 0 && stored.counter === 0)) return fail(CLONED);

  db.query("UPDATE credentials SET counter = ? WHERE id = ?").run(info.newCounter, stored.id);
  completeLogin(c);
  return c.json({ ok: true, redirect: "/account" });
});

export default app;
