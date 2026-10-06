import { expect, test } from "bun:test";
import app from "../src/app";
import { db } from "../src/db";
import { fakeCredential, fakeSession, fakeUser } from "../src/dev/fake-session";

const form = (body: Record<string, string>) => ({
  method: "POST",
  body: new URLSearchParams(body),
  headers: { "content-type": "application/x-www-form-urlencoded" } as Record<string, string>,
});
const post = (path: string, headers: HeadersInit, body: Record<string, string> = {}) => {
  const f = form(body);
  return app.request(path, { ...f, headers: { ...f.headers, ...(headers as Record<string, string>) } });
};
const credId = (userId: number) => db.query<{ id: number }, [number]>("SELECT MAX(id) AS id FROM credentials WHERE user_id = ?").get(userId)!.id;
const row = (id: number) => db.query<{ revoked_at: number | null; label: string }, [number]>("SELECT revoked_at, label FROM credentials WHERE id = ?").get(id)!;
const sessions = (userId: number) => db.query<{ n: number }, [number]>("SELECT COUNT(*) AS n FROM sessions WHERE user_id = ?").get(userId)!.n;

test("list shows kind and label, and needs a session", async () => {
  const u = fakeUser();
  fakeCredential(u, "security_key");
  db.query("UPDATE credentials SET label = 'Work key' WHERE user_id = ?").run(u);
  const html = await (await app.request("/account/devices", { headers: fakeSession("full", u) })).text();
  expect(html).toContain("Work key");
  expect(html).toContain("Security key");
  const anon = await app.request("/account/devices");
  expect([anon.status, anon.headers.get("location")]).toEqual([303, "/login"]);
});

test("revoke sets revoked_at and ends the other sessions", async () => {
  const u = fakeUser();
  fakeCredential(u);
  fakeCredential(u, "security_key");
  const id = credId(u);
  const mine = fakeSession("full", u);
  fakeSession("full", u);
  expect(sessions(u)).toBe(2);
  const res = await post(`/account/devices/${id}/revoke`, mine);
  expect(res.status).toBe(303);
  expect(row(id).revoked_at).not.toBeNull();
  expect(sessions(u)).toBe(1);
  expect((await app.request("/account/devices", { headers: mine })).status).toBe(200);
});

test("the last active credential is protected unless recovery codes exist", async () => {
  const u = fakeUser();
  fakeCredential(u);
  const id = credId(u);
  const h = fakeSession("full", u);
  const refused = await post(`/account/devices/${id}/revoke`, h);
  expect(refused.status).toBe(409);
  expect(row(id).revoked_at).toBeNull();
  await post("/account/recovery-codes", h);
  expect((await post(`/account/devices/${id}/revoke`, h)).status).toBe(303);
  expect(row(id).revoked_at).not.toBeNull();
});

test("rename works, and another user's credential is untouched", async () => {
  const u = fakeUser();
  fakeCredential(u);
  const id = credId(u);
  expect((await post(`/account/devices/${id}/rename`, fakeSession("full", u), { label: "  Phone " })).status).toBe(303);
  expect(row(id).label).toBe("Phone");
  const other = fakeUser();
  const h = fakeSession("full", other);
  expect((await post(`/account/devices/${id}/rename`, h, { label: "x" })).status).toBe(404);
  expect((await post(`/account/devices/${id}/revoke`, h)).status).toBe(404);
  expect(row(id)).toEqual({ label: "Phone", revoked_at: null });
});
