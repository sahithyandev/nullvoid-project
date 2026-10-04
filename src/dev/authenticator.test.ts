// Checks the test double against the real library, so a broken fake cannot make other tests pass.
import { expect, test } from "bun:test";
import { generateRegistrationOptions, verifyAuthenticationResponse, verifyRegistrationResponse } from "@simplewebauthn/server";
import { isoBase64URL } from "@simplewebauthn/server/helpers";
import { config } from "../config";
import { SoftwareAuthenticator } from "./authenticator";

const ceremony = async () => ({
  rpId: config.rpID,
  origin: config.origin,
  challenge: (await generateRegistrationOptions({ rpName: config.rpName, rpID: config.rpID, userName: "u" })).challenge,
});
const verifyRegister = (response: any, challenge: string) =>
  verifyRegistrationResponse({ response, expectedChallenge: challenge, expectedOrigin: config.origin, expectedRPID: config.rpID, requireUserVerification: true });

test("register() is accepted by the real library and carries the key", async () => {
  const key = new SoftwareAuthenticator();
  const c = await ceremony();
  const { verified, registrationInfo } = await verifyRegister(key.register(c), c.challenge);
  expect(verified).toBe(true);
  expect(registrationInfo!.credential.id).toBe(key.credentialIdB64);
  expect(Buffer.from(registrationInfo!.credential.publicKey)).toEqual(Buffer.from(key.cosePublicKey()));
});

test("register() without user verification is refused", async () => {
  const c = await ceremony();
  await expect(verifyRegister(new SoftwareAuthenticator().register({ ...c, userVerified: false }), c.challenge)).rejects.toThrow();
});

test("authenticate() verifies, the counter goes up, and an override is sent as given", async () => {
  const key = new SoftwareAuthenticator();
  const c = await ceremony();
  const { registrationInfo } = await verifyRegister(key.register(c), c.challenge);
  const stored = registrationInfo!.credential;
  const check = (response: any) =>
    verifyAuthenticationResponse({ response, expectedChallenge: c.challenge, expectedOrigin: config.origin, expectedRPID: config.rpID, credential: stored, requireUserVerification: true });

  expect((await check(key.authenticate(c))).authenticationInfo.newCounter).toBe(1);
  expect((await check(key.authenticate(c))).authenticationInfo.newCounter).toBe(2);
  expect((await check(key.authenticate({ ...c, counter: 7 }))).authenticationInfo.newCounter).toBe(7);
  await expect(check(key.authenticate({ ...c, userVerified: false }))).rejects.toThrow();
  expect(isoBase64URL.isBase64URL(key.authenticate(c).response.signature)).toBe(true);
});

test("the attachment shows up in both responses", async () => {
  const c = await ceremony();
  for (const attachment of ["platform", "cross-platform"] as const) {
    const key = new SoftwareAuthenticator({ attachment });
    expect(key.register(c).authenticatorAttachment).toBe(attachment);
    expect(key.authenticate(c).authenticatorAttachment).toBe(attachment);
  }
});
