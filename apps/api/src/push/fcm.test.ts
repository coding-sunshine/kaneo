import { generateKeyPairSync, verify } from "node:crypto";
import { createServer, type Server } from "node:http";
import type { AddressInfo } from "node:net";
import { afterEach, beforeEach, describe, expect, it } from "vite-plus/test";
import { createFcmSender } from "./fcm";
import type { PushMessage } from "./push-message";

// A fake of Google's token endpoint and Firebase's send endpoint.
type Seen = { url: string; headers: Record<string, unknown>; body: string };
let server: Server;
let origin: string;
let seen: Seen[];
let sendReplies: { status: number; body?: unknown }[];
let tokensIssued: number;

beforeEach(async () => {
  seen = [];
  sendReplies = [];
  tokensIssued = 0;
  server = createServer((req, res) => {
    let body = "";
    req.on("data", (chunk) => (body += chunk));
    req.on("end", () => {
      seen.push({ url: req.url ?? "", headers: req.headers, body });
      res.setHeader("content-type", "application/json");
      if (req.url === "/token") {
        tokensIssued += 1;
        res.end(
          JSON.stringify({
            access_token: `access-${tokensIssued}`,
            expires_in: 3599,
            token_type: "Bearer",
          }),
        );
        return;
      }
      const reply = sendReplies.shift() ?? {
        status: 200,
        body: { name: "projects/p/messages/1" },
      };
      res.statusCode = reply.status;
      res.end(JSON.stringify(reply.body ?? {}));
    });
  });
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  origin = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
});

afterEach(async () => {
  await new Promise<void>((resolve) => server.close(() => resolve()));
});

const keys = generateKeyPairSync("rsa", { modulusLength: 2048 });
const config = () => ({
  projectId: "kaneo-test",
  clientEmail: "push@kaneo-test.example.test",
  privateKey: keys.privateKey.export({
    type: "pkcs8",
    format: "pem",
  }) as string,
  tokenUri: `${origin}/token`,
  host: origin,
});
const message: PushMessage = {
  title: "#general",
  body: "Writer: hello",
  threadId: "channel-1",
  data: {
    kind: "chat",
    workspaceId: "ws-1",
    chatChannelId: "channel-1",
    messageId: "message-1",
  },
};
const sends = () => seen.filter((s) => s.url !== "/token");

describe("FCM sender", () => {
  it("trades a signed service-account assertion for an access token", async () => {
    const send = createFcmSender(config());
    expect(await send("device-1", message)).toBe("sent");

    const tokenRequest = seen.find((s) => s.url === "/token");
    const form = new URLSearchParams(tokenRequest?.body);
    expect(form.get("grant_type")).toBe(
      "urn:ietf:params:oauth:grant-type:jwt-bearer",
    );
    const [header, claims, signature] = (form.get("assertion") ?? "").split(
      ".",
    );
    const decoded = JSON.parse(
      Buffer.from(claims ?? "", "base64url").toString(),
    );
    expect(decoded).toMatchObject({
      iss: "push@kaneo-test.example.test",
      aud: `${origin}/token`,
      scope: "https://www.googleapis.com/auth/firebase.messaging",
    });
    expect(
      verify(
        "sha256",
        Buffer.from(`${header}.${claims}`),
        keys.publicKey,
        Buffer.from(signature ?? "", "base64url"),
      ),
    ).toBe(true);
  });

  it("sends a data message expo-notifications shows and opens from", async () => {
    const send = createFcmSender(config());
    await send("device-1", message);

    const [request] = sends();
    expect(request?.url).toBe("/v1/projects/kaneo-test/messages:send");
    expect(request?.headers.authorization).toBe("Bearer access-1");
    const { message: sent } = JSON.parse(request?.body ?? "");
    expect(sent.token).toBe("device-1");
    expect(sent.android).toEqual({ priority: "high" });
    // title and message are shown; body is the JSON that becomes content.data;
    // channelId is the Android notification channel, not the chat channel.
    expect(sent.data).toEqual({
      title: "#general",
      message: "Writer: hello",
      body: JSON.stringify({
        kind: "chat",
        workspaceId: "ws-1",
        chatChannelId: "channel-1",
        messageId: "message-1",
      }),
      channelId: "kaneo_activity",
      threadIdentifier: "channel-1",
    });
  });

  it("reuses the access token until it expires", async () => {
    const send = createFcmSender(config());
    await send("one", message);
    await send("two", message);
    expect(tokensIssued).toBe(1);
  });

  it("calls an unregistered token dead, and other failures failed", async () => {
    const send = createFcmSender(config());
    sendReplies = [
      {
        status: 404,
        body: {
          error: {
            status: "NOT_FOUND",
            details: [{ errorCode: "UNREGISTERED" }],
          },
        },
      },
      { status: 500, body: { error: { status: "INTERNAL" } } },
    ];
    expect(await send("gone", message)).toBe("dead");
    expect(await send("later", message)).toBe("failed");
  });

  it("asks for a new access token after a 401", async () => {
    const send = createFcmSender(config());
    sendReplies = [
      { status: 401, body: { error: { status: "UNAUTHENTICATED" } } },
    ];
    expect(await send("one", message)).toBe("failed");
    await send("two", message);
    expect(tokensIssued).toBe(2);
    expect(sends()[1]?.headers.authorization).toBe("Bearer access-2");
  });
});
