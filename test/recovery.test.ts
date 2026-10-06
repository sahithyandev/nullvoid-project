import { afterEach, expect, setSystemTime, test } from "bun:test";
import app from "../src/app";
import { db } from "../src/db";
import { fakeSession, fakeUser } from "../src/dev/fake-session";

const PW = "correct horse battery";
let n = 0;
const newUser = () => {
  const name = `rec-user-${++n}`;
  return { name, id: fakeUser(name, PW) };
};

afterEach(() => setSystemTime());

const makeCodes = async (id: number) => {
  const res = await app.request("/account/recovery-codes", { method: "POST", headers: fakeSession("full", id) });
  const html = await res.text();
  return { res, codes: [...html.matchAll(/<code>([A-Z0-9-]+)<\/code>/g)].map((m) => m[1]) };
};

const recover = (username: string, password: string, code: string, address = "10.2.0.1") =>
  app.request(
    "/recover",
    { method: "POST", headers: { "content-type": "application/x-www-form-urlencoded" }, body: new URLSearchParams({ username, password, code }) },
    { requestIP: () => ({ address }) },
  );

const sessionState = (res: Response) => {
  const id = res.headers.get("set-cookie")!.match(/sid=([^;]+)/)![1];
  return db.query<{ state: string }, [string]>("SELECT state FROM sessions WHERE id = ?").get(id)?.state;
};

test("codes are shown once and stored only as hashes", async () => {
  const { id } = newUser();
  const { res, codes } = await makeCodes(id);
  expect(res.status).toBe(200);
  expect(res.headers.get("cache-control")).toBe("no-store");
  expect(codes).toHaveLength(10);
  const stored = db.query<{ code_hash: string }, [number]>("SELECT code_hash FROM recovery_codes WHERE user_id = ?").all(id);
  expect(stored).toHaveLength(10);
  for (const c of codes) expect(stored.some((r) => r.code_hash.includes(c.replace("-", "")) || r.code_hash === c)).toBe(false);
  expect((await app.request("/account/recovery-codes", { method: "POST" })).status).toBe(401);
});

test("a code works once", async () => {
  const { name, id } = newUser();
  const { codes } = await makeCodes(id);
  const ok = await recover(name, PW, codes[0]);
  expect([ok.status, ok.headers.get("location"), sessionState(ok)]).toEqual([303, "/enrol", "recovery"]);
  expect((await recover(name, PW, codes[0])).status).toBe(401);
  expect((await recover(name, PW, codes[1].toLowerCase().replace("-", " "))).status).toBe(303); // forgiving format
});

test("a new set invalidates the old one", async () => {
  const { name, id } = newUser();
  const old = (await makeCodes(id)).codes;
  const fresh = (await makeCodes(id)).codes;
  expect((await recover(name, PW, old[0])).status).toBe(401);
  expect((await recover(name, PW, fresh[0])).status).toBe(303);
});

test("a wrong password or code is refused and does not use up the code", async () => {
  const { name, id } = newUser();
  const { codes } = await makeCodes(id);
  expect((await recover(name, "wrong password here", codes[0])).status).toBe(401);
  expect((await recover(name, PW, "AAAA-AAAA")).status).toBe(401);
  expect((await recover("nobody-here", PW, codes[0])).status).toBe(401);
  expect((await recover(name, PW, codes[0])).status).toBe(303);
});

test("attempts are limited per account, even with the right inputs", async () => {
  const { name, id } = newUser();
  const { codes } = await makeCodes(id);
  for (let i = 0; i < 5; i++) expect((await recover(name, "wrong password here", codes[0], "10.2.0.2")).status).toBe(401);
  const locked = await recover(name, PW, codes[0], "10.2.0.3"); // other IP, same account
  expect(locked.status).toBe(429);
  expect(await locked.text()).toContain("Try again in 15 minutes.");
  setSystemTime(Date.now() + 15 * 60_000 + 1);
  expect((await recover(name, PW, codes[0], "10.2.0.3")).status).toBe(303);
});

test("a recovery session cannot reach a requireFull route", async () => {
  const { id } = newUser();
  const headers = fakeSession("recovery", id);
  for (const path of ["/account", "/account/recovery-codes"]) {
    const res = await app.request(path, { headers });
    expect([res.status, res.headers.get("location")]).toEqual([303, "/login"]);
  }
  expect((await app.request("/account/recovery-codes", { method: "POST", headers })).status).toBe(401);
  expect((await app.request("/enrol", { headers })).status).toBe(200);
});
