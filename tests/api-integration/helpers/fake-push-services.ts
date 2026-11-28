import { generateKeyPairSync } from "node:crypto";
import { createServer as createHttpServer } from "node:http";
import {
  createServer as createHttp2Server,
  type ServerHttp2Stream,
} from "node:http2";
import type { AddressInfo } from "node:net";

export type FakePush = {
  platform: "ios" | "android";
  token: string;
  title: string;
  body: string;
  data: Record<string, unknown>;
};

/**
 * Local stand-ins for Apple's push service (plain HTTP/2) and Firebase's
 * token and send endpoints, with throwaway keys, so a test runs the real
 * senders without an Apple or Google account.
 */
export async function startFakePushServices() {
  const pushes: FakePush[] = [];
  const deadTokens = new Set<string>();

  const apns = createHttp2Server();
  apns.on("stream", (stream: ServerHttp2Stream, headers) => {
    let raw = "";
    stream.setEncoding("utf8");
    stream.on("data", (chunk) => (raw += chunk));
    stream.on("end", () => {
      const token = String(headers[":path"]).replace("/3/device/", "");
      if (deadTokens.has(token)) {
        stream.respond({ ":status": 410 });
        stream.end(JSON.stringify({ reason: "Unregistered" }));
        return;
      }
      const payload = JSON.parse(raw);
      pushes.push({
        platform: "ios",
        token,
        title: payload.aps.alert.title,
        body: payload.aps.alert.body,
        data: payload.body,
      });
      stream.respond({ ":status": 200 });
      stream.end();
    });
  });

  const fcm = createHttpServer((req, res) => {
    let raw = "";
    req.on("data", (chunk) => (raw += chunk));
    req.on("end", () => {
      res.setHeader("content-type", "application/json");
      if (req.url === "/token") {
        res.end(JSON.stringify({ access_token: "fake", expires_in: 3600 }));
        return;
      }
      const { message } = JSON.parse(raw);
      if (deadTokens.has(message.token)) {
        res.statusCode = 404;
        res.end(
          JSON.stringify({
            error: { details: [{ errorCode: "UNREGISTERED" }] },
          }),
        );
        return;
      }
      pushes.push({
        platform: "android",
        token: message.token,
        title: message.data.title,
        body: message.data.message,
        data: JSON.parse(message.data.body),
      });
      res.end(JSON.stringify({ name: "projects/fake/messages/1" }));
    });
  });

  const listen = (server: typeof apns | typeof fcm) =>
    new Promise<string>((resolve) =>
      server.listen(0, "127.0.0.1", () =>
        resolve(`http://127.0.0.1:${(server.address() as AddressInfo).port}`),
      ),
    );
  const apnsUrl = await listen(apns);
  const fcmUrl = await listen(fcm);

  const ec = generateKeyPairSync("ec", { namedCurve: "prime256v1" });
  const rsa = generateKeyPairSync("rsa", { modulusLength: 2048 });
  const env = {
    APNS_KEY_ID: "FAKEKEY",
    APNS_TEAM_ID: "FAKETEAM",
    APNS_PRIVATE_KEY: ec.privateKey.export({ type: "pkcs8", format: "pem" }),
    APNS_HOST: apnsUrl,
    FCM_SERVICE_ACCOUNT: JSON.stringify({
      project_id: "fake-project",
      client_email: "push@fake-project.example.test",
      private_key: rsa.privateKey.export({ type: "pkcs8", format: "pem" }),
      token_uri: `${fcmUrl}/token`,
    }),
    FCM_HOST: fcmUrl,
  } as Record<string, string>;

  return {
    env,
    pushes,
    deadTokens,
    close: async () => {
      await new Promise<void>((resolve) => apns.close(() => resolve()));
      await new Promise<void>((resolve) => fcm.close(() => resolve()));
    },
  };
}
