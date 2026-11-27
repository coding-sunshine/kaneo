import { createHmac } from "node:crypto";
import { describe, expect, it } from "vite-plus/test";
import { createLiveKitToken } from "./livekit-token";

const SECRET = "fake-secret-for-tests";
const decode = (part: string) =>
  JSON.parse(Buffer.from(part, "base64url").toString());

describe("createLiveKitToken", () => {
  const token = createLiveKitToken(
    { apiKey: "fake-key", apiSecret: SECRET },
    { identity: "user-1", name: "Test caller", room: "chat-1" },
    1_000_000,
  );
  const [header, payload, signature] = token.split(".") as [
    string,
    string,
    string,
  ];

  it("signs with HS256 and the API secret", () => {
    expect(decode(header)).toEqual({ alg: "HS256", typ: "JWT" });
    expect(signature).toBe(
      createHmac("sha256", SECRET)
        .update(`${header}.${payload}`)
        .digest("base64url"),
    );
  });

  it("grants joining one room as one identity for a short time", () => {
    expect(decode(payload)).toEqual({
      iss: "fake-key",
      sub: "user-1",
      name: "Test caller",
      nbf: 1_000_000 - 30,
      exp: 1_000_000 + 15 * 60,
      video: {
        room: "chat-1",
        roomJoin: true,
        canPublish: true,
        canSubscribe: true,
        canPublishData: true,
      },
    });
  });
});
