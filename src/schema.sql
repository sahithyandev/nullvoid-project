-- The whole database. Run on every start-up, so every table uses
-- CREATE TABLE IF NOT EXISTS. To start over, delete data/app.db.
-- Column names are the shared contract (see README.md). Adding columns and
-- indexes is fine; renaming or removing columns needs the whole team's agreement.

CREATE TABLE IF NOT EXISTS users (
  id            INTEGER PRIMARY KEY,
  username      TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  failed_count  INTEGER NOT NULL DEFAULT 0,
  locked_until  INTEGER NOT NULL DEFAULT 0
);

-- Written only by src/session.ts.
CREATE TABLE IF NOT EXISTS sessions (
  id         TEXT PRIMARY KEY,
  user_id    INTEGER REFERENCES users(id) ON DELETE CASCADE,
  state      TEXT NOT NULL CHECK (state IN ('password_ok', 'full', 'recovery')),
  created_at INTEGER NOT NULL,
  expires_at INTEGER NOT NULL
);

-- Passkeys use kind='passkey', security keys use kind='security_key'. Revoking only sets revoked_at.
CREATE TABLE IF NOT EXISTS credentials (
  id            INTEGER PRIMARY KEY,
  user_id       INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  kind          TEXT NOT NULL CHECK (kind IN ('passkey', 'security_key')),
  credential_id TEXT NOT NULL UNIQUE,
  public_key    BLOB NOT NULL,
  counter       INTEGER NOT NULL DEFAULT 0,
  transports    TEXT,
  label         TEXT NOT NULL DEFAULT '',
  created_at    INTEGER NOT NULL,
  revoked_at    INTEGER
);

-- A row is deleted before it is verified, so it is single use.
CREATE TABLE IF NOT EXISTS challenges (
  id         INTEGER PRIMARY KEY,
  user_id    INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  kind       TEXT NOT NULL CHECK (kind IN ('passkey', 'security_key')),
  challenge  TEXT NOT NULL,
  expires_at INTEGER NOT NULL
);

-- Only hashes are stored.
CREATE TABLE IF NOT EXISTS recovery_codes (
  id        INTEGER PRIMARY KEY,
  user_id   INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  code_hash TEXT NOT NULL,
  used_at   INTEGER
);
