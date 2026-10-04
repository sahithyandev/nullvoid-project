// Test helper: a software authenticator. It holds a private key and signs challenges like a
// phone or a security key would, but it will lie on request (skip UV, replay a counter),
// so tests can prove the server's checks without hardware.
//   const key = new SoftwareAuthenticator({ attachment: "platform" });
//   const response = key.register({ rpId: config.rpID, origin: config.origin, challenge });
import { createHash, createSign, generateKeyPairSync, randomBytes, type KeyObject } from "node:crypto";
import { isoCBOR } from "@simplewebauthn/server/helpers";

const FLAG_UP = 0x01;
const FLAG_UV = 0x04;
const FLAG_AT = 0x40;

const sha256 = (data: Uint8Array) => createHash("sha256").update(data).digest();
const b64url = (data: Uint8Array) => Buffer.from(data).toString("base64url");

type Attachment = "platform" | "cross-platform";
type Ceremony = { rpId: string; origin: string; challenge: string; userVerified?: boolean };

export class SoftwareAuthenticator {
  readonly credentialId = randomBytes(32);
  readonly attachment: Attachment;
  counter = 0;
  private privateKey: KeyObject;
  private publicJwk: { x: string; y: string };

  constructor({ attachment = "platform" }: { attachment?: Attachment } = {}) {
    this.attachment = attachment;
    const { privateKey, publicKey } = generateKeyPairSync("ec", { namedCurve: "P-256" });
    this.privateKey = privateKey;
    this.publicJwk = publicKey.export({ format: "jwk" }) as { x: string; y: string };
  }

  get credentialIdB64() {
    return b64url(this.credentialId);
  }

  /** The public key in COSE form: what the server stores. */
  cosePublicKey(): Uint8Array {
    return isoCBOR.encode(
      new Map<number, number | Uint8Array>([
        [1, 2], // kty: EC2
        [3, -7], // alg: ES256
        [-1, 1], // crv: P-256
        [-2, Buffer.from(this.publicJwk.x, "base64url")],
        [-3, Buffer.from(this.publicJwk.y, "base64url")],
      ]),
    );
  }

  private authData(rpId: string, userVerified: boolean, counter: number, attested: boolean) {
    const header = Buffer.alloc(37);
    sha256(Buffer.from(rpId)).copy(header, 0);
    header[32] = FLAG_UP | (userVerified ? FLAG_UV : 0) | (attested ? FLAG_AT : 0);
    header.writeUInt32BE(counter, 33);
    if (!attested) return header;
    const idLength = Buffer.alloc(2);
    idLength.writeUInt16BE(this.credentialId.length);
    return Buffer.concat([header, Buffer.alloc(16), idLength, this.credentialId, this.cosePublicKey()]);
  }

  private clientData(type: string, { challenge, origin }: Ceremony) {
    return Buffer.from(JSON.stringify({ type, challenge, origin, crossOrigin: false }));
  }

  /** The answer to navigator.credentials.create(), as the browser's toJSON() gives it. */
  register(c: Ceremony) {
    const authData = this.authData(c.rpId, c.userVerified ?? true, this.counter, true);
    const attestationObject = isoCBOR.encode(
      new Map<string, string | Map<string, never> | Uint8Array>([
        ["fmt", "none"],
        ["attStmt", new Map<string, never>()],
        ["authData", authData],
      ]),
    );
    return {
      id: this.credentialIdB64,
      rawId: this.credentialIdB64,
      response: {
        clientDataJSON: b64url(this.clientData("webauthn.create", c)),
        attestationObject: b64url(attestationObject),
        transports: [this.attachment === "platform" ? "internal" : "nfc"],
      },
      clientExtensionResults: {},
      type: "public-key" as const,
      authenticatorAttachment: this.attachment,
    };
  }

  /** The answer to navigator.credentials.get(). `counter` overrides the reported count, to simulate a clone. */
  authenticate(c: Ceremony & { counter?: number }) {
    const authData = this.authData(c.rpId, c.userVerified ?? true, c.counter ?? ++this.counter, false);
    const clientDataJSON = this.clientData("webauthn.get", c);
    const signature = createSign("SHA256")
      .update(Buffer.concat([authData, sha256(clientDataJSON)]))
      .sign(this.privateKey);
    return {
      id: this.credentialIdB64,
      rawId: this.credentialIdB64,
      response: {
        clientDataJSON: b64url(clientDataJSON),
        authenticatorData: b64url(authData),
        signature: b64url(signature),
      },
      clientExtensionResults: {},
      type: "public-key" as const,
      authenticatorAttachment: this.attachment,
    };
  }
}
