// Owner: M3. Routes: /security-key/*. Mounted in src/app.ts. Put every route in this file.
import { Hono } from "hono";
import { generateRegistrationOptions } from "@simplewebauthn/server";
import { config } from "../config";
import { db } from "../db";
import { requirePasswordOkOrRecovery, type AppEnv } from "../guards";
import { SecurityKeyRegisterPage } from "../views/security-key-register";

const app = new Hono<AppEnv>();
app.use("/register/*", requirePasswordOkOrRecovery);

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

export default app;
