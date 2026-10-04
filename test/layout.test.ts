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