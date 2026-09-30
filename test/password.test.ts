import { expect, test } from "bun:test";
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
