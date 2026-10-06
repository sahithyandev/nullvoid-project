import { expect, test } from "bun:test";
import app from "../src/app";

test("page shell contains a skip link", async () => {
  const res = await app.request("/");
  const html = await res.text();

  expect(html).toContain('class="skip-link"');
  expect(html).toContain('href="#main"');
});

test("page shell contains exactly one h1", async () => {
  const res = await app.request("/");
  const html = await res.text();

  const h1Count = (html.match(/<h1>/g) || []).length;

  expect(h1Count).toBe(1);
});

test("page shell contains an aria-live status region", async () => {
  const res = await app.request("/");
  const html = await res.text();

  expect(html).toContain('id="status"');
  expect(html).toContain('role="status"');
  expect(html).toContain('aria-live="polite"');
});
test("nav shows sign in when anonymous, sign out when fully signed in", async () => {
  const anon = await (await app.request("/")).text();
  expect(anon.split("</header>")[0]).not.toContain("<nav");

  const { db } = await import("../src/db");
  const uid = db.query("INSERT INTO users (username, password_hash) VALUES ('navtest', 'x') RETURNING id").get() as { id: number };
  db.query("INSERT INTO sessions (id, user_id, state, created_at, expires_at) VALUES ('navsid', ?, 'full', 0, ?)").run(uid.id, Date.now() + 60000);
  const html = await (await app.request("/", { headers: { cookie: "sid=navsid" } })).text();
  expect(html.split("</header>")[0]).toContain('action="/logout"');
  expect(html.split("</header>")[0]).not.toContain('href="/login"');
});
