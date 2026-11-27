import {
  createHash,
  generateKeyPairSync,
  randomBytes,
  sign,
} from "node:crypto";

const sha256 = (data: Buffer | string) =>
  createHash("sha256").update(data).digest();

/**
 * A software passkey: a P-256 key stored the way Better Auth stores one
 * (base64 COSE), which signs assertions like a browser authenticator does.
 */
export function createSoftwarePasskey() {
  const { privateKey, publicKey } = generateKeyPairSync("ec", {
    namedCurve: "P-256",
  });
  const jwk = publicKey.export({ format: "jwk" });
  // CBOR map {1: 2 (EC2), 3: -7 (ES256), -1: 1 (P-256), -2: x, -3: y}.
  const cose = Buffer.concat([
    Buffer.from([0xa5, 0x01, 0x02, 0x03, 0x26, 0x20, 0x01, 0x21, 0x58, 0x20]),
    Buffer.from(jwk.x ?? "", "base64url"),
    Buffer.from([0x22, 0x58, 0x20]),
    Buffer.from(jwk.y ?? "", "base64url"),
  ]);
  const credentialID = randomBytes(16).toString("base64url");

  return {
    credentialID,
    publicKey: cose.toString("base64"),
    /** The response a browser sends; `userVerified` sets the UV flag. */
    assert(
      challenge: string,
      options: { origin: string; rpID: string; userVerified: boolean },
    ) {
      const clientDataJSON = Buffer.from(
        JSON.stringify({
          type: "webauthn.get",
          challenge,
          origin: options.origin,
          crossOrigin: false,
        }),
      );
      const flags = 0x01 | (options.userVerified ? 0x04 : 0);
      const authenticatorData = Buffer.concat([
        sha256(options.rpID),
        Buffer.from([flags]),
        Buffer.alloc(4),
      ]);
      const signature = sign(
        "sha256",
        Buffer.concat([authenticatorData, sha256(clientDataJSON)]),
        privateKey,
      );
      return {
        id: credentialID,
        rawId: credentialID,
        type: "public-key",
        response: {
          clientDataJSON: clientDataJSON.toString("base64url"),
          authenticatorData: authenticatorData.toString("base64url"),
          signature: signature.toString("base64url"),
        },
        clientExtensionResults: {},
      };
    },
  };
}
