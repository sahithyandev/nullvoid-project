import { expect, test } from "bun:test";
import app from "./app";

test("home page responds and has the page shell", async () => {
  const res = await app.request("/");
  expect(res.status).toBe(200);
  const html = await res.text();
  expect(html).toContain('aria-live="polite"');
  expect(html).toContain("<h1>");
});

test("static files are served", async () => {
  const res = await app.request("/static/js/a11y.js");
  expect(res.status).toBe(200);
});

test("oat is served and linked from the layout", async () => {
  for (const f of ["oat.min.css", "oat.min.js"]) expect((await app.request(`/static/oat/${f}`)).status).toBe(200);
  expect(await (await app.request("/login")).text()).toContain("/static/oat/oat.min.css");
});
