import { expect, test } from "bun:test";
import app from "../src/app";
import { config } from "../src/config";
import { db } from "../src/db";
import { SoftwareAuthenticator } from "../src/dev/authenticator";
import { fakeCredential, fakeSession, fakeUser } from "../src/dev/fake-session";

type State = "password_ok" | "full" | "recovery";
const json = (headers: HeadersInit) => ({ ...headers, "content-type": "application/json" });
const post = (path: string, headers: HeadersInit, body?: unknown) =>
  app.request(`/security-key/register/${path}`, { method: "POST", headers: json(headers), body: body === undefined ? undefined : JSON.stringify(body) });
const options = async (headers: HeadersInit) => (await post("options", headers)).json() as Promise<any>;
const rows = (userId: number) => db.query<any, [number]>("SELECT * FROM credentials WHERE user_id = ? AND kind = 'security_key'").all(userId);
const challenges = (userId: number) => db.query("SELECT 1 FROM challenges WHERE user_id = ? AND kind = 'security_key'").all(userId).length;
const stateOf = (headers: any) =>
  db.query<{ state: string }, [string]>("SELECT state FROM sessions WHERE id = ?").get(headers.cookie.slice(4));

function setup(state: State = "password_ok") {
  const userId = fakeUser();
  return { userId, headers: fakeSession(state, userId), key: new SoftwareAuthenticator({ attachment: "cross-platform" }) };
}
const answer = (key: SoftwareAuthenticator, opts: any, extra: object = {}) =>
  key.register({ rpId: config.rpID, origin: config.origin, challenge: opts.challenge, ...extra });
const loginPost = (path: string, headers: HeadersInit, body?: unknown) =>
  app.request(`/security-key/login/${path}`, { method: "POST", headers: json(headers), body: body === undefined ? undefined : JSON.stringify(body) });
const loginOptions = async (headers: HeadersInit) => (await loginPost("options", headers)).json() as Promise<any>;
const loginAnswer = (key: SoftwareAuthenticator, opts: any, extra: object = {}) =>
  key.authenticate({ rpId: config.rpID, origin: config.origin, challenge: opts.challenge, ...extra });
const credentialCounter = (key: SoftwareAuthenticator) =>
  db.query<{ counter: number }, [string]>("SELECT counter FROM credentials WHERE credential_id = ?").get(key.credentialIdB64)!.counter;

function loginSetup() {
  const userId = fakeUser();
  return { userId, headers: fakeSession("password_ok", userId), key: fakeCredential(userId, "security_key") };
}

test("registration routes require a password_ok or recovery session", async () => {
  expect((await app.request("/security-key/register/options", { method: "POST" })).status).toBe(401);
  expect((await app.request("/security-key/register/verify", { method: "POST" })).status).toBe(401);
  const full = fakeSession("full");
  expect((await post("options", full)).status).toBe(401);
  expect((await post("verify", full, {})).status).toBe(401);
});

test("successful cross-platform registration stores public credential data and does not complete login", async () => {
  for (const state of ["password_ok", "recovery"] as const) {
    const { userId, headers, key } = setup(state);
    const opts = await options(headers);
    expect(opts.authenticatorSelection).toMatchObject({ authenticatorAttachment: "cross-platform", userVerification: "required" });
    expect(challenges(userId)).toBe(1);

    const res = await post("verify", headers, answer(key, opts));
    expect([res.status, await res.json()]).toEqual([200, { ok: true, redirect: "/second-factor" }]);
    const [row] = rows(userId);
    expect(row).toMatchObject({ kind: "security_key", credential_id: key.credentialIdB64, counter: 0, revoked_at: null });
    expect(Buffer.from(row.public_key)).toEqual(Buffer.from(key.cosePublicKey()));
    expect(JSON.parse(row.transports)).toEqual(["nfc"]);
    expect(challenges(userId)).toBe(0);
    expect(stateOf(headers)).toEqual({ state });
  }
});

test("a registration response and its challenge cannot be replayed", async () => {
  const { userId, headers, key } = setup();
  const response = answer(key, await options(headers));
  expect((await post("verify", headers, response)).status).toBe(200);

  const replay = await post("verify", headers, response);
  expect([replay.status, (await replay.json()).reason]).toEqual([400, "This request has expired or was already used. Please start again."]);
  expect(rows(userId)).toHaveLength(1);
});

test("a response without user verification is refused after consuming its challenge", async () => {
  const { userId, headers, key } = setup();
  const res = await post("verify", headers, answer(key, await options(headers), { userVerified: false }));
  expect(res.status).toBe(400);
  expect((await res.json()).reason).toContain("did not confirm it was you");
  expect(rows(userId)).toHaveLength(0);
  expect(challenges(userId)).toBe(0);
});

test("the same security-key credential cannot be stored twice", async () => {
  const { userId, headers, key } = setup();
  expect((await post("verify", headers, answer(key, await options(headers)))).status).toBe(200);

  const second = await post("verify", headers, answer(key, await options(headers)));
  expect([second.status, (await second.json()).reason]).toEqual([409, "This security key is already registered to an account."]);
  expect(rows(userId)).toHaveLength(1);
});

test("wrong challenge, origin, and RP ID are refused without storing a credential", async () => {
  const { userId, headers, key } = setup();
  const wrongChallenge = await post("verify", headers, key.register({ rpId: config.rpID, origin: config.origin, challenge: "not-the-stored-challenge" }));
  expect(wrongChallenge.status).toBe(400);

  const wrongOrigin = await post("verify", headers, answer(key, await options(headers), { origin: "https://evil.example" }));
  expect((await wrongOrigin.json()).reason).toContain("different website");

  const wrongRpId = await post("verify", headers, answer(key, await options(headers), { rpId: "evil.example" }));
  expect((await wrongRpId.json()).reason).toContain("different website");
  expect(rows(userId)).toHaveLength(0);
});

test("security-key login routes require a password_ok session", async () => {
  expect((await app.request("/security-key/login/options", { method: "POST" })).status).toBe(401);
  expect((await app.request("/security-key/login/verify", { method: "POST" })).status).toBe(401);
  for (const state of ["full", "recovery"] as const) {
    const headers = fakeSession(state);
    expect((await loginPost("options", headers)).status).toBe(401);
    expect((await loginPost("verify", headers, {})).status).toBe(401);
  }
});

test("successful security-key login verifies the key, updates its counter, and completes login", async () => {
  const { userId, headers, key } = loginSetup();
  const opts = await loginOptions(headers);
  expect(opts.userVerification).toBe("required");
  expect(opts.allowCredentials.map((credential: any) => credential.id)).toEqual([key.credentialIdB64]);

  const res = await loginPost("verify", headers, loginAnswer(key, opts));
  expect([res.status, await res.json()]).toEqual([200, { ok: true, redirect: "/account" }]);
  expect(stateOf(headers)).toBeNull();
  expect(res.headers.get("set-cookie")).toContain("sid=");
  expect(credentialCounter(key)).toBe(1);
  expect(challenges(userId)).toBe(0);
});

test("a security-key authentication response and its challenge cannot be replayed", async () => {
  const { userId, headers, key } = loginSetup();
  const response = loginAnswer(key, await loginOptions(headers));
  expect((await loginPost("verify", headers, response)).status).toBe(200);

  const again = fakeSession("password_ok", userId);
  const replay = await loginPost("verify", again, response);
  expect([replay.status, (await replay.json()).reason]).toEqual([400, "This request has expired or was already used. Please start again."]);
  expect(stateOf(again)).toEqual({ state: "password_ok" });
});

test("a security key without user verification cannot complete login", async () => {
  const { userId, headers, key } = loginSetup();
  const res = await loginPost("verify", headers, loginAnswer(key, await loginOptions(headers), { userVerified: false }));
  expect(res.status).toBe(400);
  expect((await res.json()).reason).toContain("did not confirm it was you");
  expect(challenges(userId)).toBe(0);
  expect(credentialCounter(key)).toBe(0);
  expect(stateOf(headers)).toEqual({ state: "password_ok" });
});

test("a revoked security key is not offered and cannot authenticate when submitted directly", async () => {
  const { userId, headers, key } = loginSetup();
  const response = loginAnswer(key, await loginOptions(headers));
  db.query("UPDATE credentials SET revoked_at = 1 WHERE credential_id = ?").run(key.credentialIdB64);

  const res = await loginPost("verify", headers, response);
  expect([res.status, (await res.json()).reason]).toEqual([400, "This security key is not active on your account. Please choose another method."]);
  expect(stateOf(headers)).toEqual({ state: "password_ok" });
  expect((await loginPost("options", headers)).status).toBe(400);
  expect(db.query<{ revoked_at: number | null }, [string]>("SELECT revoked_at FROM credentials WHERE credential_id = ?").get(key.credentialIdB64)).toEqual({ revoked_at: 1 });
  expect(userId).toBeGreaterThan(0);
});

test("wrong challenge, origin, and RP ID do not complete a security-key login", async () => {
  const { headers, key } = loginSetup();
  const wrongChallenge = await loginPost("verify", headers, key.authenticate({ rpId: config.rpID, origin: config.origin, challenge: "not-the-stored-challenge" }));
  expect(wrongChallenge.status).toBe(400);

  const wrongOrigin = await loginPost("verify", headers, loginAnswer(key, await loginOptions(headers), { origin: "https://evil.example" }));
  expect((await wrongOrigin.json()).reason).toContain("different website");

  const wrongRpId = await loginPost("verify", headers, loginAnswer(key, await loginOptions(headers), { rpId: "evil.example" }));
  expect((await wrongRpId.json()).reason).toContain("different website");
  expect(stateOf(headers)).toEqual({ state: "password_ok" });
});

test("a security-key counter rollback is refused without changing the stored counter", async () => {
  const { headers, key } = loginSetup();
  db.query("UPDATE credentials SET counter = 5 WHERE credential_id = ?").run(key.credentialIdB64);
  const res = await loginPost("verify", headers, loginAnswer(key, await loginOptions(headers), { counter: 3 }));
  expect([res.status, (await res.json()).reason]).toEqual([400, "This security key's sign-in count went backwards, so it was refused."]);
  expect(credentialCounter(key)).toBe(5);
  expect(stateOf(headers)).toEqual({ state: "password_ok" });
});

test("another user's security key and a passkey cannot authenticate this user", async () => {
  const { headers, key } = loginSetup();
  const otherUser = fakeUser();
  const otherKey = fakeCredential(otherUser, "security_key");
  const passkey = fakeCredential(otherUser, "passkey");

  const foreign = await loginPost("verify", headers, loginAnswer(otherKey, await loginOptions(headers)));
  expect(foreign.status).toBe(400);
  expect(stateOf(headers)).toEqual({ state: "password_ok" });

  const wrongKind = await loginPost("verify", headers, loginAnswer(passkey, await loginOptions(headers)));
  expect(wrongKind.status).toBe(400);
  expect(stateOf(headers)).toEqual({ state: "password_ok" });
  expect(key.attachment).toBe("cross-platform");
});
