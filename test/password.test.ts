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
