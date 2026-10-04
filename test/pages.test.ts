import { expect, test } from "bun:test";
import app from "../src/app";
import { fakeSession } from "../src/dev/fake-session";

const get = (path: string, state?: "password_ok" | "full" | "recovery") =>
  app.request(path, state ? { headers: fakeSession(state) } : undefined);

const cases = [
  ["/second-factor", ["password_ok"], ['href="/passkey/login"', 'href="/security-key/login"']],
  ["/enrol", ["password_ok", "recovery"], ['href="/passkey/register"', 'href="/security-key/register"']],
  ["/account", ["full"], ['href="/account/devices"', 'href="/account/recovery-codes"']],
] as const;

for (const [path, allowed, links] of cases) {
  test(`${path} needs the right session state and renders its links`, async () => {
    const anon = await get(path);
    expect([anon.status, anon.headers.get("location")]).toEqual([303, "/login"]);
    for (const state of ["password_ok", "full", "recovery"] as const) {
      const res = await get(path, state);
      if (!(allowed as readonly string[]).includes(state)) {
        expect(res.status).toBe(303);
        continue;
      }
      expect(res.status).toBe(200);
      const html = await res.text();
      for (const link of links) expect(html).toContain(link);
    }
  });
}
