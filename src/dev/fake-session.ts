// Test helper: puts a request into any session state without the login pages.
//   const res = await app.request("/passkey/login/options", { method: "POST", headers: await fakeSession("password_ok") });
import { db } from "../db";
import { config } from "../config";

let counter = 0;

/** Creates a bare user row for tests. The password hash is a placeholder. */
export function fakeUser(username = `user${++counter}`): number {
  db.query("INSERT INTO users (username, password_hash) VALUES (?, 'x')").run(username);
  return db.query<{ id: number }, [string]>("SELECT id FROM users WHERE username = ?").get(username)!.id;
}

/** Returns headers carrying a session cookie in the given state. Makes a user if none is given. */
export function fakeSession(state: "password_ok" | "full" | "recovery", userId = fakeUser()): HeadersInit {
  const id = `fake-${crypto.randomUUID()}`;
  const now = Date.now();
  db.query("INSERT INTO sessions (id, user_id, state, created_at, expires_at) VALUES (?, ?, ?, ?, ?)").run(
    id, userId, state, now, now + config.sessionTtlMs[state],
  );
  return { cookie: `sid=${id}` };
}
