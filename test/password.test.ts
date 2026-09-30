import { afterEach, expect, setSystemTime, test } from "bun:test";
import { attemptKeys, clear, fail, lockedFor, lockMessage } from "../src/attempts";
import { db } from "../src/db";
import { checkPassword, checkUsername, createUser, verifyLogin } from "../src/password";

const PW = "correct horse battery";

test("the stored hash is Argon2id and not the password", async () => {
  const id = (await createUser("hash-user", PW)) as number;
  const { password_hash } = db.query<{ password_hash: string }, [number]>("SELECT password_hash FROM users WHERE id = ?").get(id)!;
  expect(password_hash).not.toBe(PW);
  expect(password_hash).not.toContain(PW);
  expect(password_hash.startsWith("$argon2id$")).toBe(true);
  expect(await verifyLogin("hash-user", PW)).toBe(id);
  expect(await verifyLogin("hash-user", "wrong password here")).toBeNull();
});

test("a duplicate username is rejected", async () => {
  expect(typeof (await createUser("dup-user", PW))).toBe("number");
  expect(await createUser("dup-user", PW)).toBe("That username is taken.");
});

test("weak, empty and bad-username inputs get a specific message", () => {
  expect(checkPassword("alice", "")).toBe("Enter a password.");
  expect(checkPassword("alice", "short")).toBe("Password must be at least 12 characters.");
  expect(checkPassword("alice", "x".repeat(129))).toBe("Password must be at most 128 characters.");
  expect(checkPassword("alice-the-user", "ALICE-THE-USER")).toBe("Password must not be your username.");
  expect(checkPassword("alice", PW)).toBeNull();
  expect(checkUsername("")).toContain("Username must be");
  expect(checkUsername("a b")).toContain("Username must be");
  expect(checkUsername("alice")).toBeNull();
});

afterEach(() => setSystemTime());

test("the account locks after 5 failures and unlocks after 15 minutes", () => {
  const keys = attemptKeys("Lock-User", "10.0.0.1");
  for (let i = 0; i < 4; i++) fail(keys);
  expect(lockedFor(keys)).toBe(0);
  fail(keys);
  expect(lockedFor(keys)).toBeGreaterThan(0);
  expect(lockedFor(attemptKeys("lock-user", "10.0.0.2"))).toBeGreaterThan(0); // same account, other IP
  expect(lockMessage(lockedFor(keys))).toBe("Too many attempts. Try again in 15 minutes.");
  setSystemTime(Date.now() + 15 * 60_000 + 1);
  expect(lockedFor(keys)).toBe(0);
});

test("the IP locks after 20 failures across accounts, and success clears the account", () => {
  for (let i = 0; i < 20; i++) fail(attemptKeys(`ip-user-${i}`, "10.0.0.3"));
  expect(lockedFor(attemptKeys("fresh-user", "10.0.0.3"))).toBeGreaterThan(0);
  const keys = attemptKeys("clear-user", "10.0.0.4");
  for (let i = 0; i < 4; i++) fail(keys);
  clear(keys[0]);
  fail(keys);
  expect(lockedFor(keys)).toBe(0);
});

// --- HTTP: /register and /login ---
import app from "../src/app";

const post = (path: string, username: string, password: string, address = "10.1.0.1") =>
  app.request(
    path,
    { method: "POST", headers: { "content-type": "application/x-www-form-urlencoded" }, body: new URLSearchParams({ username, password }) },
    { requestIP: () => ({ address }) },
  );

const sessionState = (res: Response) => {
  const id = res.headers.get("set-cookie")!.match(/sid=([^;]+)/)![1];
  return db.query<{ state: string }, [string]>("SELECT state FROM sessions WHERE id = ?").get(id)?.state;
};

test("registering rejects weak passwords and duplicates over HTTP", async () => {
  const weak = await post("/register", "http-weak", "short");
  expect(weak.status).toBe(400);
  expect(await weak.text()).toContain("Password must be at least 12 characters.");
  expect((await post("/register", "http-dup", PW)).status).toBe(303);
  const dup = await post("/register", "http-dup", PW);
  expect(dup.status).toBe(400);
  expect(await dup.text()).toContain("That username is taken.");
});

test("an unknown user and a wrong password look the same", async () => {
  await createUser("same-user", PW);
  const time = async (u: string) => {
    const t = performance.now();
    const res = await post("/login", u, "wrong password here", "10.1.0.2");
    return { status: res.status, body: (await res.text()).replace(/value="[^"]*"/, ""), ms: performance.now() - t };
  };
  const known = await time("same-user");
  const unknown = await time("nobody-here");
  expect(known.status).toBe(401);
  expect(unknown.status).toBe(401);
  expect(unknown.body).toBe(known.body);
  expect(unknown.ms).toBeLessThan(known.ms * 3);
  expect(known.ms).toBeLessThan(unknown.ms * 3);
});

test("login locks out even for the right password, then unlocks", async () => {
  await createUser("lock-http", PW);
  for (let i = 0; i < 5; i++) expect((await post("/login", "lock-http", "wrong password here", "10.1.0.3")).status).toBe(401);
  const locked = await post("/login", "lock-http", PW, "10.1.0.4"); // other IP, same account
  expect(locked.status).toBe(429);
  expect(await locked.text()).toContain("Try again in 15 minutes.");
  setSystemTime(Date.now() + 15 * 60_000 + 1);
  expect((await post("/login", "lock-http", PW, "10.1.0.4")).status).toBe(303);
});

test("one IP is locked after 20 failures across accounts", async () => {
  for (let i = 0; i < 20; i++) await post("/login", `spray-${i}`, "wrong password here", "10.1.0.5");
  await createUser("spray-real", PW);
  expect((await post("/login", "spray-real", PW, "10.1.0.5")).status).toBe(429);
});

test("a successful login reaches password_ok and redirects by credential", async () => {
  const id = (await createUser("redirect-user", PW)) as number;
  const first = await post("/login", "redirect-user", PW, "10.1.0.6");
  expect([first.status, first.headers.get("location"), sessionState(first)]).toEqual([303, "/enrol", "password_ok"]);

  const insert = (revoked: number | null) =>
    db.query("INSERT INTO credentials (user_id, kind, credential_id, public_key, created_at, revoked_at) VALUES (?, 'passkey', ?, x'00', 0, ?)").run(id, crypto.randomUUID(), revoked);
  insert(1); // revoked only: still no active credential
  expect((await post("/login", "redirect-user", PW, "10.1.0.6")).headers.get("location")).toBe("/enrol");
  insert(null);
  expect((await post("/login", "redirect-user", PW, "10.1.0.6")).headers.get("location")).toBe("/second-factor");
});
