// Routes: /account/devices. Mounted by src/routes/account.ts.
import { Hono } from "hono";
import { requireFullOrRecovery, type AppEnv } from "../guards";
import { db } from "../db";
import { endUserSessions } from "../session";
import { DevicesPage, type Device } from "../views/devices";

const app = new Hono<AppEnv>();

app.use("/devices", requireFullOrRecovery);
app.use("/devices/*", requireFullOrRecovery);

const list = (userId: number) =>
  db
    .query<Device, [number]>("SELECT id, kind, label, created_at, revoked_at FROM credentials WHERE user_id = ? ORDER BY created_at, id")
    .all(userId);

app.get("/devices", (c) => c.html(DevicesPage({ devices: list(c.get("userId")) })));

app.post("/devices/:id/rename", async (c) => {
  const label = String((await c.req.parseBody()).label ?? "").trim().slice(0, 64);
  const r = db.query("UPDATE credentials SET label = ? WHERE id = ? AND user_id = ?").run(label, c.req.param("id"), c.get("userId"));
  return r.changes ? c.redirect("/account/devices", 303) : c.text("Not found", 404);
});

app.post("/devices/:id/revoke", (c) => {
  const userId = c.get("userId");
  const id = c.req.param("id");
  const result = db.transaction(() => {
    const target = db
      .query<{ revoked_at: number | null }, [string, number]>("SELECT revoked_at FROM credentials WHERE id = ? AND user_id = ?")
      .get(id, userId);
    if (!target) return "missing";
    if (target.revoked_at) return "ok";
    const active = db.query<{ n: number }, [number]>("SELECT COUNT(*) AS n FROM credentials WHERE user_id = ? AND revoked_at IS NULL").get(userId)!.n;
    const codes = db.query("SELECT 1 FROM recovery_codes WHERE user_id = ? AND used_at IS NULL").get(userId);
    if (active === 1 && !codes) return "last";
    db.query("UPDATE credentials SET revoked_at = ? WHERE id = ? AND user_id = ?").run(Date.now(), id, userId);
    return "ok";
  })();
  if (result === "missing") return c.text("Not found", 404);
  if (result === "last")
    return c.html(
      DevicesPage({
        devices: list(userId),
        error: "This is your only active passkey or security key. Make recovery codes first, or add another one, so you cannot be locked out.",
      }),
      409,
    );
  endUserSessions(userId, c.get("sessionId"));
  return c.redirect("/account/devices", 303);
});

export default app;
