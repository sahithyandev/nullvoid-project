// Owner: M1. Password rules, hashing and checking. Never log a password.
import { db } from "./db";

const hash = (password: string) => Bun.password.hash(password, { algorithm: "argon2id" });

// Verified when the user is unknown, so both failures cost one Argon2id verify.
const DUMMY_HASH = await hash("nullvoid-dummy-password");

/** A specific message for a bad username, or null if it is fine. */
export function checkUsername(username: string): string | null {
  if (!/^[A-Za-z0-9._-]{3,32}$/.test(username))
    return "Username must be 3 to 32 characters: letters, numbers, dot, dash or underscore.";
  return null;
}

/** A specific message for a weak or empty password, or null if it is fine. */
export function checkPassword(username: string, password: string): string | null {
  if (!password) return "Enter a password.";
  if (password.length < 12) return "Password must be at least 12 characters.";
  if (password.length > 128) return "Password must be at most 128 characters.";
  if (password.toLowerCase() === username.toLowerCase()) return "Password must not be your username.";
  return null;
}

/** Creates the user. Returns the new user id, or a message if the username is taken. */
export async function createUser(username: string, password: string): Promise<number | string> {
  try {
    const row = db
      .query<{ id: number }, [string, string]>("INSERT INTO users (username, password_hash) VALUES (?, ?) RETURNING id")
      .get(username, await hash(password));
    return row!.id;
  } catch (e) {
    if (e instanceof Error && /UNIQUE/.test(e.message)) return "That username is taken.";
    throw e;
  }
}

/** The user id if the password is right, otherwise null. */
export async function verifyLogin(username: string, password: string): Promise<number | null> {
  const row = db
    .query<{ id: number; password_hash: string }, [string]>("SELECT id, password_hash FROM users WHERE username = ?")
    .get(username);
  const ok = await Bun.password.verify(password, row?.password_hash ?? DUMMY_HASH);
  return row && ok ? row.id : null;
}
