import { expect, test } from "bun:test";
import app from "../src/app";
import { config } from "../src/config";
import { db } from "../src/db";
import { SoftwareAuthenticator } from "../src/dev/authenticator";
import { fakeSession, fakeUser } from "../src/dev/fake-session";

type State = "password_ok" | "full" | "recovery";
const json = (headers: HeadersInit) => ({ ...headers, "content-type": "application/json" });
const post = (path: string, headers: HeadersInit, body?: unknown) =>
  app.request(`/passkey/register/${path}`, { method: "POST", headers: json(headers), body: body === undefined ? undefined : JSON.stringify(body) });
const options = async (headers: HeadersInit) => (await post("options", headers)).json() as Promise<any>;
const rows = (userId: number) => db.query<any, [number]>("SELECT * FROM credentials WHERE user_id = ? AND kind = 'passkey'").all(userId);
const challenges = (userId: number) => db.query("SELECT 1 FROM challenges WHERE user_id = ? AND kind = 'passkey'").all(userId).length;

function setup(state: State = "password_ok") {
  const userId = fakeUser();
  return { userId, headers: fakeSession(state, userId), key: new SoftwareAuthenticator({ attachment: "platform" }) };
}
const answer = (key: SoftwareAuthenticator, opts: any, extra: object = {}) =>
  key.register({ rpId: config.rpID, origin: config.origin, challenge: opts.challenge, ...extra });

test("the routes are mounted and need a password_ok or recovery session", async () => {
  expect((await app.request("/passkey/register/options", { method: "POST" })).status).toBe(401);
  expect((await app.request("/passkey/register/verify", { method: "POST" })).status).toBe(401);
  const full = fakeSession("full");
  expect((await post("options", full)).status).toBe(401);
  expect((await post("verify", full, {})).status).toBe(401);
});

test("happy path: platform + UV required, only public data stored, challenge used up", async () => {
  for (const state of ["password_ok", "recovery"] as const) {
    const { userId, headers, key } = setup(state);
    const opts = await options(headers);
    expect(opts.authenticatorSelection).toMatchObject({ authenticatorAttachment: "platform", userVerification: "required" });
    expect(opts.excludeCredentials).toEqual([]);
    expect(challenges(userId)).toBe(1);

    const res = await post("verify", headers, answer(key, opts));
    expect([res.status, await res.json()]).toEqual([200, { ok: true, redirect: "/second-factor" }]);
    const [row] = rows(userId);
    expect(row).toMatchObject({ kind: "passkey", credential_id: key.credentialIdB64, counter: 0, revoked_at: null });
    expect(Buffer.from(row.public_key)).toEqual(Buffer.from(key.cosePublicKey()));
    expect(challenges(userId)).toBe(0);
  }
});

test("a replayed response and a response to an old challenge are refused", async () => {
  const { userId, headers, key } = setup();
  const opts = await options(headers);
  const response = answer(key, opts);
  expect((await post("verify", headers, response)).status).toBe(200);
  const replay = await post("verify", headers, response);
  expect([replay.status, (await replay.json()).reason]).toEqual([400, "This request has expired or was already used. Please start again."]);
  expect(rows(userId)).toHaveLength(1);

  const other = setup();
  const stale = answer(other.key, await options(other.headers));
  await options(other.headers); // a new attempt replaces the first challenge
  expect((await post("verify", other.headers, stale)).status).toBe(400);
  expect(rows(other.userId)).toHaveLength(0);
});

test("an expired challenge is refused", async () => {
  const { userId, headers, key } = setup();
  const opts = await options(headers);
  db.query("UPDATE challenges SET expires_at = ? WHERE user_id = ?").run(Date.now() - 1, userId);
  expect((await post("verify", headers, answer(key, opts))).status).toBe(400);
  expect(rows(userId)).toHaveLength(0);
});

test("a response without user verification is refused and the challenge is still spent", async () => {
  const { userId, headers, key } = setup();
  const opts = await options(headers);
  const res = await post("verify", headers, answer(key, opts, { userVerified: false }));
  expect(res.status).toBe(400);
  expect((await res.json()).reason).toContain("did not confirm it was you");
  expect(rows(userId)).toHaveLength(0);
  expect(challenges(userId)).toBe(0);
});

test("a response from the wrong origin is refused", async () => {
  const { userId, headers, key } = setup();
  const opts = await options(headers);
  const res = await post("verify", headers, answer(key, opts, { origin: "https://evil.example" }));
  expect(res.status).toBe(400);
  expect((await res.json()).reason).toContain("different website");
  expect(rows(userId)).toHaveLength(0);
});

test("a duplicate authenticator is excluded and cannot be registered twice", async () => {
  const { userId, headers, key } = setup();
  expect((await post("verify", headers, answer(key, await options(headers)))).status).toBe(200);

  const again = await options(headers);
  expect(again.excludeCredentials.map((c: any) => c.id)).toEqual([key.credentialIdB64]);
  const res = await post("verify", headers, answer(key, again));
  expect([res.status, (await res.json()).reason]).toEqual([409, "This device already has a passkey for this account."]);
  expect(rows(userId)).toHaveLength(1);
});

test("a revoked passkey is not excluded, and malformed bodies are refused", async () => {
  const { userId, headers, key } = setup();
  await post("verify", headers, answer(key, await options(headers)));
  db.query("UPDATE credentials SET revoked_at = 1 WHERE user_id = ?").run(userId);
  expect((await options(headers)).excludeCredentials).toEqual([]);
  expect((await post("verify", headers, { nonsense: true })).status).toBe(400);
  const bad = await app.request("/passkey/register/verify", { method: "POST", headers, body: "not json" });
  expect(bad.status).toBe(400);
});
