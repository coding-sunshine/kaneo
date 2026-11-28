import { generateKeyPairSync, verify } from "node:crypto";
import {
  createServer,
  type Http2Server,
  type ServerHttp2Stream,
} from "node:http2";
import type { AddressInfo } from "node:net";
import { afterEach, beforeEach, describe, expect, it } from "vite-plus/test";
import { createApnsSender } from "./apns";
import type { PushMessage } from "./push-message";

// A fake of Apple's push service: plain-text HTTP/2 on a local port.
type Seen = { headers: Record<string, string>; body: string };
let server: Http2Server;
let host: string;
let seen: Seen[];
let replies: { status: number; reason?: string }[];

beforeEach(async () => {
  seen = [];
  replies = [];
  server = createServer();
  server.on("stream", (stream: ServerHttp2Stream, headers) => {
    let body = "";
    stream.setEncoding("utf8");
    stream.on("data", (chunk) => (body += chunk));
    stream.on("end", () => {
      seen.push({ headers: headers as Record<string, string>, body });
      const reply = replies.shift() ?? { status: 200 };
      stream.respond({ ":status": reply.status });
      stream.end(reply.reason ? JSON.stringify({ reason: reply.reason }) : "");
    });
  });
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  host = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
});

afterEach(async () => {
  await new Promise<void>((resolve) => server.close(() => resolve()));
});

const keys = generateKeyPairSync("ec", { namedCurve: "prime256v1" });
const config = () => ({
  keyId: "KEY123",
  teamId: "TEAM456",
  privateKey: keys.privateKey.export({
    type: "pkcs8",
    format: "pem",
  }) as string,
  topic: "app.kaneo",
  host,
});
const message: PushMessage = {
  title: "#general",
  body: "Writer: hello",
  threadId: "channel-1",
  data: { kind: "chat", workspaceId: "ws-1", chatChannelId: "channel-1" },
};

describe("APNs sender", () => {
  it("posts an alert with the chat data under body, signed with the team key", async () => {
    const send = createApnsSender(config());
    expect(await send("abc123", message)).toBe("sent");

    const [request] = seen;
    expect(request?.headers[":method"]).toBe("POST");
    expect(request?.headers[":path"]).toBe("/3/device/abc123");
    expect(request?.headers["apns-topic"]).toBe("app.kaneo");
    expect(request?.headers["apns-push-type"]).toBe("alert");
    // expo-notifications reads content.data from the payload's body key.
    expect(JSON.parse(request?.body ?? "")).toEqual({
      aps: {
        alert: { title: "#general", body: "Writer: hello" },
        sound: "default",
        "thread-id": "channel-1",
      },
      body: { kind: "chat", workspaceId: "ws-1", chatChannelId: "channel-1" },
    });

    const jwt = request?.headers.authorization?.replace(/^bearer /, "") ?? "";
    const [header, claims, signature] = jwt.split(".");
    expect(
      JSON.parse(Buffer.from(header ?? "", "base64url").toString()),
    ).toEqual({ alg: "ES256", typ: "JWT", kid: "KEY123" });
    expect(
      JSON.parse(Buffer.from(claims ?? "", "base64url").toString()).iss,
    ).toBe("TEAM456");
    expect(
      verify(
        "sha256",
        Buffer.from(`${header}.${claims}`),
        { key: keys.publicKey, dsaEncoding: "ieee-p1363" },
        Buffer.from(signature ?? "", "base64url"),
      ),
    ).toBe(true);
  });

  it("reuses the signed token across pushes", async () => {
    const send = createApnsSender(config());
    await send("one", message);
    await send("two", message);
    expect(seen[0]?.headers.authorization).toBe(seen[1]?.headers.authorization);
  });

  it("calls a token Apple no longer knows dead, and other failures failed", async () => {
    const send = createApnsSender(config());
    replies = [
      { status: 410, reason: "Unregistered" },
      { status: 400, reason: "BadDeviceToken" },
      { status: 500, reason: "InternalServerError" },
      { status: 403, reason: "InvalidProviderToken" },
    ];
    expect(await send("gone", message)).toBe("dead");
    expect(await send("bad", message)).toBe("dead");
    expect(await send("later", message)).toBe("failed");
    expect(await send("key", message)).toBe("failed");
  });

  it("reports an unreachable service as failed", async () => {
    const send = createApnsSender({ ...config(), host: "http://127.0.0.1:1" });
    expect(await send("abc", message)).toBe("failed");
  });
});
