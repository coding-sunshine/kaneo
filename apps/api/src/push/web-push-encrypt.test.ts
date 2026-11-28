import { createECDH } from "node:crypto";
import { describe, expect, it } from "vite-plus/test";
import { encryptWebPush } from "./web-push-encrypt";

const b64 = (value: string) => Buffer.from(value, "base64url");

// The worked example in RFC 8291, section 5 and appendix A.
const RFC = {
  plaintext: "When I grow up, I want to be a watermelon",
  authSecret: "BTBZMqHH6r4Tts7J_aSIgg",
  uaPublic:
    "BCVxsr7N_eNgVRqvHtD0zTZsEc6-VV-JvLexhqUzORcxaOzi6-AYWXvTBHm4bjyPjs7Vd8pZGH6SRpkNtoIAiw4",
  asPrivate: "yfWPiYE-n46HLnH0KqZOF1fJJU3MYrct3AELtAQ-oRw",
  salt: "DGv6ra1nlYgDCS1FRnbzlw",
  body:
    "DGv6ra1nlYgDCS1FRnbzlwAAEABBBP4z9KsN6nGRTbVYI_c7VJSPQTBtkgcy27ml" +
    "mlMoZIIgDll6e3vCYLocInmYWAmS6TlzAC8wEqKK6PBru3jl7A_yl95bQpu6cVPT" +
    "pK4Mqgkf1CXztLVBSt2Ks3oZwbuwXPXLWyouBWLVWGNWQexSgSxsj_Qulcy4a-fN",
};

describe("web push encryption", () => {
  it("matches the RFC 8291 example byte for byte", () => {
    const server = createECDH("prime256v1");
    server.setPrivateKey(b64(RFC.asPrivate));
    const body = encryptWebPush(
      Buffer.from(RFC.plaintext),
      { p256dh: RFC.uaPublic, auth: RFC.authSecret },
      { server, salt: b64(RFC.salt) },
    );
    expect(body.toString("base64url")).toBe(RFC.body);
  });

  it("uses a fresh key and salt for every message", () => {
    const keys = { p256dh: RFC.uaPublic, auth: RFC.authSecret };
    const first = encryptWebPush(Buffer.from("hi"), keys);
    const second = encryptWebPush(Buffer.from("hi"), keys);
    expect(first.subarray(0, 16)).not.toEqual(second.subarray(0, 16));
    expect(first.subarray(21, 86)).not.toEqual(second.subarray(21, 86));
  });
});
