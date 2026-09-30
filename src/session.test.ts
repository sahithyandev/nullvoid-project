import { expect, test } from "bun:test";
import { Hono } from "hono";
import { completeLogin, endUserSessions, getSession, startPasswordOk } from "./session";
import { requireFull, requirePasswordOk, requireRecovery, type AppEnv } from "./guards";
import { fakeSession, fakeUser } from "./dev/fake-session";

const app = new Hono<AppEnv>();
app.get("/pw", requirePasswordOk, (c) => c.text("ok"));
app.get("/full", requireFull, (c) => c.text("ok"));
app.post("/full", requireFull, (c) => c.text("ok"));
app.get("/rec", requireRecovery, (c) => c.text("ok"));
app.get("/state", (c) => c.json(getSession(c)));
app.post("/start/:id", (c) => (startPasswordOk(c, Number(c.req.param("id"))), c.text("started")));
app.post("/complete", (c) => (completeLogin(c), c.text("done")));

test("guards let only the right state through", async () => {
  expect((await app.request("/pw", { headers: fakeSession("password_ok") })).status).toBe(200);
  expect((await app.request("/full", { headers: fakeSession("password_ok") })).status).toBe(303);
  expect((await app.request("/full", { headers: fakeSession("recovery") })).status).toBe(303);
  expect((await app.request("/rec", { headers: fakeSession("recovery") })).status).toBe(200);
  expect((await app.request("/full")).status).toBe(303);
  expect((await app.request("/full", { method: "POST" })).status).toBe(401);
});

test("password_ok becomes full with a new session ID", async () => {
  const userId = fakeUser();
  const start = await app.request(`/start/${userId}`, { method: "POST" });
  const cookie1 = start.headers.get("set-cookie")!.split(";")[0];
  expect(start.headers.get("set-cookie")).toContain("HttpOnly");
  const done = await app.request("/complete", { method: "POST", headers: { cookie: cookie1 } });
  const cookie2 = done.headers.get("set-cookie")!.split(";")[0];
  expect(cookie2).not.toBe(cookie1);
  const old = await (await app.request("/state", { headers: { cookie: cookie1 } })).json();
  expect(old.state).toBe("anonymous");
  const now = await (await app.request("/state", { headers: { cookie: cookie2 } })).json();
  expect(now).toMatchObject({ state: "full", userId });
});

test("completeLogin refuses an anonymous session", async () => {
  expect((await app.request("/complete", { method: "POST" })).status).toBe(500);
});

test("endUserSessions ends the user's sessions", async () => {
  const userId = fakeUser();
  const headers = fakeSession("full", userId);
  endUserSessions(userId);
  expect((await (await app.request("/state", { headers })).json()).state).toBe("anonymous");
});
