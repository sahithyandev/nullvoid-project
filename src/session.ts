// Session contract. Never change the signatures; ask the whole team first.
import type { Context } from "hono";
import { deleteCookie, getCookie, setCookie } from "hono/cookie";
import { config } from "./config";
import { db } from "./db";

export type SessionState = "anonymous" | "password_ok" | "full" | "recovery";
export type Session =
  | { state: "anonymous"; id: null; userId: null }
  | { state: Exclude<SessionState, "anonymous">; id: string; userId: number };

const COOKIE = "sid";

function newId(): string {
  return Buffer.from(crypto.getRandomValues(new Uint8Array(32))).toString("base64url");
}

/** The current session. Expired or unknown cookies count as anonymous. */
export function getSession(c: Context): Session {
  const id = getCookie(c, COOKIE);
  if (id) {
    const row = db
      .query<{ user_id: number; state: Session["state"] }, [string, number]>(
        "SELECT user_id, state FROM sessions WHERE id = ? AND expires_at > ?",
      )
      .get(id, Date.now());
    if (row) return { id, userId: row.user_id, state: row.state } as Session;
  }
  return { state: "anonymous", id: null, userId: null };
}

/** Replaces any current session with a new one (new ID, so no session fixation). */
function start(c: Context, userId: number, state: "password_ok" | "full" | "recovery") {
  deleteRow(c);
  const id = newId();
  const now = Date.now();
  const ttl = config.sessionTtlMs[state];
  db.query("INSERT INTO sessions (id, user_id, state, created_at, expires_at) VALUES (?, ?, ?, ?, ?)").run(
    id, userId, state, now, now + ttl,
  );
  setCookie(c, COOKIE, id, {
    httpOnly: true,
    sameSite: "Lax",
    secure: config.secureCookies,
    path: "/",
    maxAge: ttl / 1000,
  });
}

/** First factor passed. Second factor still pending. Used by the password module. */
export function startPasswordOk(c: Context, userId: number) {
  start(c, userId, "password_ok");
}

/** Second factor passed. Only valid from password_ok. Used by the passkey and security-key modules. */
export function completeLogin(c: Context) {
  const s = getSession(c);
  if (s.state !== "password_ok") throw new Error("completeLogin needs a password_ok session");
  start(c, s.userId, "full");
}

/** Recovered with a code. This session may only replace credentials. Used by the recovery module. */
export function startRecovery(c: Context, userId: number) {
  start(c, userId, "recovery");
}

function deleteRow(c: Context) {
  const id = getCookie(c, COOKIE);
  if (id) db.query("DELETE FROM sessions WHERE id = ?").run(id);
}

/** Signs out the current session. */
export function endSession(c: Context) {
  deleteRow(c);
  deleteCookie(c, COOKIE, { path: "/" });
}

/** Ends every session of a user, except optionally one. Used when a credential is revoked. */
export function endUserSessions(userId: number, exceptId?: string | null) {
  db.query("DELETE FROM sessions WHERE user_id = ? AND id IS NOT ?").run(userId, exceptId ?? null);
}
