// Owner: M5. Recovery codes: made on request, stored only as hashes, single use. Never log a code.
import { db } from "./db";

const ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // no 0/O/1/I
const COUNT = 10;

const normalise = (code: string) => code.toUpperCase().replace(/[^A-Z0-9]/g, "");
const hash = (code: string) => new Bun.CryptoHasher("sha256").update(normalise(code)).digest("hex");

function newCode(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(8));
  const s = Array.from(bytes, (b) => ALPHABET[b % ALPHABET.length]).join("");
  return `${s.slice(0, 4)}-${s.slice(4)}`;
}

/** Replaces the user's codes with a new set. The plain codes are returned once and never stored. */
export function generateCodes(userId: number): string[] {
  const codes = Array.from({ length: COUNT }, newCode);
  db.transaction(() => {
    db.query("DELETE FROM recovery_codes WHERE user_id = ?").run(userId);
    for (const c of codes) db.query("INSERT INTO recovery_codes (user_id, code_hash) VALUES (?, ?)").run(userId, hash(c));
  })();
  return codes;
}

/** True if the code was valid and unused. Marks it used in the same statement, so it works once. */
export function useCode(userId: number, code: string): boolean {
  const r = db
    .query("UPDATE recovery_codes SET used_at = ? WHERE user_id = ? AND code_hash = ? AND used_at IS NULL")
    .run(Date.now(), userId, hash(code));
  return r.changes === 1;
}
