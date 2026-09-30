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
