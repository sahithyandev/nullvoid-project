// Values shared by every module. Change here, not in the modules.
const origin = process.env.ORIGIN ?? "http://localhost:3000";

export const config = {
  rpName: "NullVoid",
  rpID: new URL(origin).hostname, // WebAuthn RP ID: the site's domain, no port
  origin, // WebAuthn expected origin, including the port
  secureCookies: origin.startsWith("https://"),
  // Bun sets NODE_ENV=test under `bun test`, so tests get a throwaway database.
  dbPath: process.env.DB_PATH ?? (process.env.NODE_ENV === "test" ? ":memory:" : "data/app.db"),
  // How long each session state lasts. The pending states are short on purpose.
  sessionTtlMs: {
    password_ok: 10 * 60_000,
    recovery: 15 * 60_000,
    full: 8 * 60 * 60_000,
  },
  challengeTtlMs: 5 * 60_000,
};
