// Routes: /register and /login. Mounted in src/app.ts. Put every route in this file.
import { Hono } from "hono";
import { getConnInfo } from "@hono/bun";
import type { AppEnv } from "../guards";
import { startPasswordOk } from "../session";
import { db } from "../db";
import { attemptKeys, clear, fail, lockedFor, lockMessage } from "../attempts";
import { checkPassword, checkUsername, createUser, verifyLogin } from "../password";
import { LoginPage } from "../views/login";
import { RegisterPage } from "../views/register";

const app = new Hono<AppEnv>();

const ip = (c: Parameters<typeof getConnInfo>[0]) => {
  try {
    return getConnInfo(c).remote.address ?? "unknown";
  } catch {
    return "unknown";
  }
};

const hasCredential = (userId: number) =>
  !!db.query("SELECT 1 FROM credentials WHERE user_id = ? AND revoked_at IS NULL").get(userId);

app.get("/register", (c) => c.html(RegisterPage({})));

app.post("/register", async (c) => {
  const body = await c.req.parseBody();
  const username = String(body.username ?? "").trim();
  const password = String(body.password ?? "");
  const error = checkUsername(username) ?? checkPassword(username, password);
  if (error) return c.html(RegisterPage({ error, username }), 400);
  const id = await createUser(username, password);
  if (typeof id === "string") return c.html(RegisterPage({ error: id, username }), 400);
  startPasswordOk(c, id);
  return c.redirect("/enrol", 303); // a new account has no credential yet
});

app.get("/login", (c) => c.html(LoginPage({})));

app.post("/login", async (c) => {
  const body = await c.req.parseBody();
  const username = String(body.username ?? "").trim();
  const password = String(body.password ?? "");
  const keys = attemptKeys(username, ip(c));

  const wait = lockedFor(keys);
  if (wait > 0) return c.html(LoginPage({ error: lockMessage(wait), username }), 429);

  const id = await verifyLogin(username, password);
  if (id === null) {
    fail(keys);
    return c.html(LoginPage({ error: "Username or password is incorrect.", username }), 401);
  }
  clear(keys[0]);
  startPasswordOk(c, id);
  return c.redirect(hasCredential(id) ? "/second-factor" : "/enrol", 303);
});

export default app;
