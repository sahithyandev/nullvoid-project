// Owner: M2. Routes: /passkey/register*. Mounted by src/routes/passkey.ts.
import { Hono } from "hono";
import { generateRegistrationOptions, verifyRegistrationResponse, type RegistrationResponseJSON } from "@simplewebauthn/server";
import { config } from "../config";
import { db } from "../db";
import { requirePasswordOkOrRecovery, type AppEnv } from "../guards";

const app = new Hono<AppEnv>();
app.use("/register/*", requirePasswordOkOrRecovery);

const EXPIRED = "This request has expired or was already used. Please start again.";
const DUPLICATE = "This device already has a passkey for this account.";
const WRONG_SITE = "This response came from a different website, so it was refused.";
const NO_UV = "Your device did not confirm it was you with a fingerprint, face or screen lock. Please try again.";
const UNVERIFIED = "Your device's response could not be verified. Please try again.";

app.post("/register/options", async (c) => {
  const userId = c.get("userId");
  const user = db.query<{ username: string }, [number]>("SELECT username FROM users WHERE id = ?").get(userId);
  if (!user) return c.json({ ok: false, reason: "Your account was not found. Please sign in again." }, 401);

  const active = db
    .query<{ credential_id: string }, [number]>("SELECT credential_id FROM credentials WHERE user_id = ? AND kind = 'passkey' AND revoked_at IS NULL")
    .all(userId);
  const options = await generateRegistrationOptions({
    rpName: config.rpName,
    rpID: config.rpID,
    userName: user.username,
    userID: new TextEncoder().encode(String(userId)),
    attestationType: "none",
    excludeCredentials: active.map((r) => ({ id: r.credential_id })),
    authenticatorSelection: { authenticatorAttachment: "platform", userVerification: "required", residentKey: "preferred" },
  });

  // One open challenge per user, so every attempt starts fresh.
  db.query("DELETE FROM challenges WHERE user_id = ? AND kind = 'passkey'").run(userId);
  db.query("INSERT INTO challenges (user_id, kind, challenge, expires_at) VALUES (?, 'passkey', ?, ?)").run(
    userId, options.challenge, Date.now() + config.challengeTtlMs,
  );
  return c.json(options);
});

app.post("/register/verify", async (c) => {
  const userId = c.get("userId");
  const fail = (status: 400 | 409, reason: string) => c.json({ ok: false, reason }, status);

  let body: RegistrationResponseJSON;
  try {
    body = await c.req.json();
  } catch {
    return fail(400, UNVERIFIED);
  }

  // Deleted before it is checked, so a challenge can never be tried twice.
  const row = db
    .query<{ challenge: string; expires_at: number }, [number]>("DELETE FROM challenges WHERE user_id = ? AND kind = 'passkey' RETURNING challenge, expires_at")
    .get(userId);
  if (!row || row.expires_at <= Date.now()) return fail(400, EXPIRED);

  let info;
  try {
    const result = await verifyRegistrationResponse({
      response: body,
      expectedChallenge: row.challenge,
      expectedOrigin: config.origin,
      expectedRPID: config.rpID,
      requireUserVerification: true,
    });
    info = result.verified ? result.registrationInfo : undefined;
  } catch (e) {
    const message = e instanceof Error ? e.message : "";
    return fail(400, /origin|RP ID/i.test(message) ? WRONG_SITE : /user verif/i.test(message) ? NO_UV : UNVERIFIED);
  }
  if (!info) return fail(400, UNVERIFIED);
  if (!info.userVerified) return fail(400, NO_UV);

  const { credential } = info;
  try {
    db.query("INSERT INTO credentials (user_id, kind, credential_id, public_key, counter, created_at) VALUES (?, 'passkey', ?, ?, ?, ?)").run(
      userId, credential.id, credential.publicKey, credential.counter, Date.now(),
    );
  } catch {
    return fail(409, DUPLICATE); // credential_id is UNIQUE
  }
  return c.json({ ok: true, redirect: "/second-factor" });
});

export default app;
