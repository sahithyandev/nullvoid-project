// Routes: /recover/*. Mounted in src/app.ts. Put every route in this file.
import { Hono } from "hono";
import { getConnInfo } from "@hono/bun";
import type { AppEnv } from "../guards";
import { db } from "../db";
import { startRecovery } from "../session";
import { useCode } from "../recovery-codes";
import { clear, fail, lockedFor, lockMessage, recoveryKeys } from "../recovery-limit";
import { RecoverPage } from "../views/recover";

const app = new Hono<AppEnv>();

// Verified when the user is unknown, so both failures cost one Argon2id verify.
const DUMMY_HASH = await Bun.password.hash("nullvoid-dummy-password", { algorithm: "argon2id" });

const ip = (c: Parameters<typeof getConnInfo>[0]) => {
  try {
    return getConnInfo(c).remote.address ?? "unknown";
  } catch {
    return "unknown";
  }
};

app.get("/", (c) => c.html(RecoverPage({})));

app.post("/", async (c) => {
  const body = await c.req.parseBody();
  const username = String(body.username ?? "").trim();
  const password = String(body.password ?? "");
  const code = String(body.code ?? "");
  const keys = recoveryKeys(username, ip(c));

  const wait = lockedFor(keys);
  if (wait > 0) return c.html(RecoverPage({ error: lockMessage(wait), username }), 429);

  const row = db
    .query<{ id: number; password_hash: string }, [string]>("SELECT id, password_hash FROM users WHERE username = ?")
    .get(username);
  const passwordOk = await Bun.password.verify(password, row?.password_hash ?? DUMMY_HASH);
  // The code is only checked, and so only used up, when the password is right.
  if (!row || !passwordOk || !useCode(row.id, code)) {
    fail(keys);
    return c.html(RecoverPage({ error: "Username, password or recovery code is incorrect.", username }), 401);
  }
  clear(keys[0]);
  startRecovery(c, row.id);
  return c.redirect("/enrol", 303);
});

export default app;
