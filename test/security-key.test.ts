import { expect, test } from "bun:test";
import app from "../src/app";
import { config } from "../src/config";
import { db } from "../src/db";
import type { SoftwareAuthenticator } from "../src/dev/authenticator";
import {
  fakeCredential,
  fakeSession,
  fakeUser,
} from "../src/dev/fake-session";

const json = (headers: HeadersInit) => ({
  ...headers,
  "content-type": "application/json",
});

const post = (
  path: string,
  headers: HeadersInit,
  body?: unknown,
) =>
  app.request(`/security-key/login/${path}`, {
    method: "POST",
    headers: json(headers),
    body:
      body === undefined
        ? undefined
        : JSON.stringify(body),
  });

const options = async (headers: HeadersInit) =>
  (await post("options", headers)).json() as Promise<any>;

const challenges = (userId: number) =>
  db
    .query(
      "SELECT 1 FROM challenges WHERE user_id = ? AND kind = 'security_key'",
    )
    .all(userId).length;

const counter = (key: SoftwareAuthenticator) =>
  db
    .query<{ counter: number }, [string]>(
      "SELECT counter FROM credentials WHERE credential_id = ?",
    )
    .get(key.credentialIdB64)!.counter;

const stateOf = (headers: any) =>
  db
    .query<{ state: string }, [string]>(
      "SELECT state FROM sessions WHERE id = ?",
    )
    .get(headers.cookie.slice(4));

function setup() {
  const userId = fakeUser();

  return {
    userId,
    headers: fakeSession("password_ok", userId),
    key: fakeCredential(userId, "security_key"),
  };
}

const answer = (
  key: SoftwareAuthenticator,
  opts: any,
  extra: object = {},
) =>
  key.authenticate({
    rpId: config.rpID,
    origin: config.origin,
    challenge: opts.challenge,
    ...extra,
  });

test(
  "the routes are mounted and need a password_ok session",
  async () => {
    expect(
      (
        await app.request(
          "/security-key/login/options",
          { method: "POST" },
        )
      ).status,
    ).toBe(401);

    expect(
      (
        await app.request(
          "/security-key/login/verify",
          { method: "POST" },
        )
      ).status,
    ).toBe(401);

    for (const state of ["full", "recovery"] as const) {
      const headers = fakeSession(state);

      expect(
        (await post("options", headers)).status,
      ).toBe(401);

      expect(
        (await post("verify", headers, {})).status,
      ).toBe(401);
    }
  },
);

test(
  "happy path: security key + UV required, session becomes full, counter stored",
  async () => {
    const { userId, headers, key } = setup();

    const opts = await options(headers);

    expect(opts.userVerification).toBe("required");

    expect(
      opts.allowCredentials.map((c: any) => c.id),
    ).toEqual([key.credentialIdB64]);

    expect(challenges(userId)).toBe(1);

    const res = await post(
      "verify",
      headers,
      answer(key, opts),
    );

    expect(
      [res.status, await res.json()],
    ).toEqual([
      200,
      {
        ok: true,
        redirect: "/account",
      },
    ]);

    expect(stateOf(headers)).toBeNull();

    expect(
      res.headers.get("set-cookie"),
    ).toContain("sid=");

    expect(counter(key)).toBe(1);

    expect(challenges(userId)).toBe(0);
  },
);

test(
  "a security key that reports counter 0 is accepted",
  async () => {
    const { headers, key } = setup();

    const res = await post(
      "verify",
      headers,
      answer(
        key,
        await options(headers),
        { counter: 0 },
      ),
    );

    expect(res.status).toBe(200);
    expect(counter(key)).toBe(0);
  },
);

test(
  "a counter that goes backwards is refused",
  async () => {
    const { headers, key } = setup();

    db.query(
      "UPDATE credentials SET counter = 5 WHERE credential_id = ?",
    ).run(key.credentialIdB64);

    for (const sent of [3, 5]) {
      const res = await post(
        "verify",
        headers,
        answer(
          key,
          await options(headers),
          { counter: sent },
        ),
      );

      expect(
        [
          res.status,
          (await res.json()).reason,
        ],
      ).toEqual([
        400,
        "This security key's sign-in count went backwards, so it was refused.",
      ]);
    }

    expect(counter(key)).toBe(5);

    expect(stateOf(headers)).toEqual({
      state: "password_ok",
    });
  },
);

test(
  "a replayed response is refused and does not sign in",
  async () => {
    const { userId, headers, key } = setup();

    const response = answer(
      key,
      await options(headers),
    );

    expect(
      (await post("verify", headers, response)).status,
    ).toBe(200);

    const again = fakeSession(
      "password_ok",
      userId,
    );

    const replay = await post(
      "verify",
      again,
      response,
    );

    expect(
      [
        replay.status,
        (await replay.json()).reason,
      ],
    ).toEqual([
      400,
      "This request has expired or was already used. Please start again.",
    ]);

    expect(stateOf(again)).toEqual({
      state: "password_ok",
    });
  },
);

test(
  "an old challenge and an expired challenge are refused",
  async () => {
    const { userId, headers, key } = setup();

    const stale = answer(
      key,
      await options(headers),
    );

    const fresh = await options(headers);

    expect(
      (await post("verify", headers, stale)).status,
    ).toBe(400);

    await options(headers);

    db.query(
      "UPDATE challenges SET expires_at = ? WHERE user_id = ?",
    ).run(
      Date.now() - 1,
      userId,
    );

    expect(
      (
        await post(
          "verify",
          headers,
          answer(key, fresh),
        )
      ).status,
    ).toBe(400);

    expect(stateOf(headers)).toEqual({
      state: "password_ok",
    });
  },
);

test(
  "a response without user verification is refused and the challenge is still spent",
  async () => {
    const { userId, headers, key } = setup();

    const res = await post(
      "verify",
      headers,
      answer(
        key,
        await options(headers),
        { userVerified: false },
      ),
    );

    expect(res.status).toBe(400);

    expect(
      (await res.json()).reason,
    ).toContain(
      "did not confirm user verification",
    );

    expect(challenges(userId)).toBe(0);

    expect(stateOf(headers)).toEqual({
      state: "password_ok",
    });
  },
);

test(
  "a response from the wrong origin is refused",
  async () => {
    const { headers, key } = setup();

    const res = await post(
      "verify",
      headers,
      answer(
        key,
        await options(headers),
        {
          origin: "https://evil.example",
        },
      ),
    );

    expect(res.status).toBe(400);

    expect(
      (await res.json()).reason,
    ).toContain("different website");

    expect(stateOf(headers)).toEqual({
      state: "password_ok",
    });
  },
);

test(
  "a revoked security key is not offered and is refused even if the browser sends it",
  async () => {
    const { userId, headers, key } = setup();

    const other = fakeCredential(
      userId,
      "security_key",
    );

    const opts = await options(headers);

    const response = answer(key, opts);

    db.query(
      "UPDATE credentials SET revoked_at = 1 WHERE credential_id = ?",
    ).run(key.credentialIdB64);

    expect(
      (
        await options(headers)
      ).allowCredentials.map(
        (c: any) => c.id,
      ),
    ).toEqual([other.credentialIdB64]);

    const res = await post(
      "verify",
      headers,
      response,
    );

    expect(
      [
        res.status,
        (await res.json()).reason,
      ],
    ).toEqual([
      400,
      "This security key is not active on your account. Please choose another method.",
    ]);

    expect(stateOf(headers)).toEqual({
      state: "password_ok",
    });

    db.query(
      "UPDATE credentials SET revoked_at = 1 WHERE user_id = ?",
    ).run(userId);

    expect(
      (await post("options", headers)).status,
    ).toBe(400);
  },
);

test(
  "another user's security key and malformed bodies are refused",
  async () => {
    const { headers } = setup();

    const stranger = setup();

    const opts = await options(headers);

    expect(
      (
        await post(
          "verify",
          headers,
          answer(stranger.key, opts),
        )
      ).status,
    ).toBe(400);

    expect(
      (
        await post(
          "verify",
          headers,
          { nonsense: true },
        )
      ).status,
    ).toBe(400);

    expect(
      (
        await app.request(
          "/security-key/login/verify",
          {
            method: "POST",
            headers,
            body: "not json",
          },
        )
      ).status,
    ).toBe(400);
  },
);

test(
  "the page names the website and says what the device will do, and is guarded",
  async () => {
    const anon = await app.request(
      "/security-key/login",
    );

    expect([
      anon.status,
      anon.headers.get("location"),
    ]).toEqual([
      303,
      "/login",
    ]);

    expect(
      (
        await app.request(
          "/security-key/login",
          {
            headers: fakeSession("full"),
          },
        )
      ).status,
    ).toBe(303);

    const res = await app.request(
      "/security-key/login",
      {
        headers: fakeSession("password_ok"),
      },
    );

    expect(res.status).toBe(200);

    const html = await res.text();

    expect(html).toContain(
      `${config.rpName} (${config.rpID}) is asking you to sign in with your security key`,
    );

    expect(html).toContain(
      "tap your security key near the NFC area",
    );

    expect(html).toContain("PIN");

    expect(html).toContain(
      "/static/js/security-key.js",
    );

    expect(
      (
        await app.request(
          "/static/js/security-key.js",
        )
      ).status,
    ).toBe(200);
  },
);