// Routes: /security-key/*. Mounted in src/app.ts. Put every route in this file.
import { Hono } from "hono";
import {
  generateAuthenticationOptions,
  generateRegistrationOptions,
  verifyAuthenticationResponse,
  verifyRegistrationResponse,
  type AuthenticationResponseJSON,
  type RegistrationResponseJSON,
} from "@simplewebauthn/server";
import { config } from "../config";
import { db } from "../db";
import { requirePasswordOk, requirePasswordOkOrRecovery, type AppEnv } from "../guards";
import { completeLogin } from "../session";
import { SecurityKeyLoginPage } from "../views/security-key-login";
import { SecurityKeyRegisterPage } from "../views/security-key-register";

const app = new Hono<AppEnv>();
app.use("/register/*", requirePasswordOkOrRecovery);
app.use("/login/*", requirePasswordOk);

const EXPIRED = "This request has expired or was already used. Please start again.";
const DUPLICATE = "This security key is already registered to an account.";
const SAVE_FAILED = "The security key could not be saved. Please try again.";
const WRONG_SITE = "This response came from a different website, so it was refused.";
const NO_UV = "Your security key did not confirm it was you. Please complete its PIN or verification step and try again.";
const UNVERIFIED = "Your security key's response could not be verified. Please try again.";
const NO_SECURITY_KEY = "You have no active security key. Please choose another method.";
const REVOKED = "This security key is not active on your account. Please choose another method.";
const CLONED = "This security key's sign-in count went backwards, so it was refused.";
const LOGIN_SAVE_FAILED = "The security key sign-in could not be completed. Please try again.";

app.get("/register", (c) => c.html(SecurityKeyRegisterPage()));

app.post("/register/options", async (c) => {
  const userId = c.get("userId");
  const user = db.query<{ username: string }, [number]>("SELECT username FROM users WHERE id = ?").get(userId);
  if (!user) return c.json({ ok: false, reason: "Your account was not found. Please sign in again." }, 401);

  const active = db
    .query<{ credential_id: string }, [number]>(
      "SELECT credential_id FROM credentials WHERE user_id = ? AND kind = 'security_key' AND revoked_at IS NULL",
    )
    .all(userId);
  const options = await generateRegistrationOptions({
    rpName: config.rpName,
    rpID: config.rpID,
    userName: user.username,
    userID: new TextEncoder().encode(String(userId)),
    attestationType: "none",
    excludeCredentials: active.map((row) => ({ id: row.credential_id })),
    authenticatorSelection: { authenticatorAttachment: "cross-platform", userVerification: "required", residentKey: "preferred" },
  });

  // One open security-key challenge per user, so every attempt starts fresh.
  db.query("DELETE FROM challenges WHERE user_id = ? AND kind = 'security_key'").run(userId);
  db.query("INSERT INTO challenges (user_id, kind, challenge, expires_at) VALUES (?, 'security_key', ?, ?)").run(
    userId,
    options.challenge,
    Date.now() + config.challengeTtlMs,
  );
  return c.json(options);
});

app.post("/register/verify", async (c) => {
  const userId = c.get("userId");
  const fail = (status: 400 | 409 | 500, reason: string) => c.json({ ok: false, reason }, status);

  let body: RegistrationResponseJSON;
  try {
    body = await c.req.json();
  } catch {
    return fail(400, UNVERIFIED);
  }

  // Delete before verification so this challenge is single-use even when verification fails.
  const row = db
    .query<{ challenge: string; expires_at: number }, [number]>(
      "DELETE FROM challenges WHERE user_id = ? AND kind = 'security_key' RETURNING challenge, expires_at",
    )
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
  const transports = credential.transports ?? [];
  try {
    db.query(
      "INSERT INTO credentials (user_id, kind, credential_id, public_key, counter, transports, created_at) VALUES (?, 'security_key', ?, ?, ?, ?, ?)",
    ).run(userId, credential.id, credential.publicKey, credential.counter, JSON.stringify(transports), Date.now());
  } catch (e) {
    if (e instanceof Error && /UNIQUE constraint failed: credentials\.credential_id/i.test(e.message)) return fail(409, DUPLICATE);
    return fail(500, SAVE_FAILED);
  }
  return c.json({ ok: true, redirect: "/second-factor" });
});

app.get("/login", (c) => c.html(SecurityKeyLoginPage()));

app.post("/login/options", async (c) => {
  const userId = c.get("userId");
  const active = db
    .query<{ credential_id: string; transports: string | null }, [number]>(
      "SELECT credential_id, transports FROM credentials WHERE user_id = ? AND kind = 'security_key' AND revoked_at IS NULL",
    )
    .all(userId);
  if (active.length === 0) return c.json({ ok: false, reason: NO_SECURITY_KEY }, 400);

  const options = await generateAuthenticationOptions({
    rpID: config.rpID,
    userVerification: "required",
    allowCredentials: active.map((row) => ({ id: row.credential_id, transports: row.transports ? JSON.parse(row.transports) : undefined })),
  });

  // One open security-key challenge per user, so every attempt starts fresh.
  db.query("DELETE FROM challenges WHERE user_id = ? AND kind = 'security_key'").run(userId);
  db.query("INSERT INTO challenges (user_id, kind, challenge, expires_at) VALUES (?, 'security_key', ?, ?)").run(
    userId,
    options.challenge,
    Date.now() + config.challengeTtlMs,
  );
  return c.json(options);
});

app.post("/login/verify", async (c) => {
  const userId = c.get("userId");
  const fail = (reason: string, status: 400 | 500 = 400) => c.json({ ok: false, reason }, status);

  let body: AuthenticationResponseJSON;
  try {
    body = await c.req.json();
  } catch {
    return fail(UNVERIFIED);
  }

  // Delete before verification so a challenge is single-use even when verification fails.
  let row;
  try {
    row = db
      .query<{ challenge: string; expires_at: number }, [number]>(
        "DELETE FROM challenges WHERE user_id = ? AND kind = 'security_key' RETURNING challenge, expires_at",
      )
      .get(userId);
  } catch {
    return fail(LOGIN_SAVE_FAILED, 500);
  }
  if (!row || row.expires_at <= Date.now()) return fail(EXPIRED);

  let stored;
  try {
    stored = db
      .query<{ id: number; credential_id: string; public_key: Uint8Array<ArrayBuffer>; counter: number }, [string | null, number]>(
        "SELECT id, credential_id, public_key, counter FROM credentials WHERE credential_id = ? AND user_id = ? AND kind = 'security_key' AND revoked_at IS NULL",
      )
      .get(typeof body?.id === "string" ? body.id : null, userId);
  } catch {
    return fail(LOGIN_SAVE_FAILED, 500);
  }
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
  // The counter must increase. Synced credentials may continue to report 0.
  if (info.newCounter <= stored.counter && !(info.newCounter === 0 && stored.counter === 0)) return fail(CLONED);

  try {
    db.query("UPDATE credentials SET counter = ? WHERE id = ?").run(info.newCounter, stored.id);
  } catch {
    return fail(LOGIN_SAVE_FAILED, 500);
  }
  completeLogin(c);
  return c.json({ ok: true, redirect: "/account" });
});

export default app;
