import { afterEach, describe, expect, it } from "vite-plus/test";
import { createFakePop3Server } from "./fake-pop3-server";
import { openPop3 } from "./pop3-client";

const first = [
  "From: a@example.test",
  "Subject: One",
  "",
  ".leading dot line",
  "body",
].join("\r\n");
const second = ["From: b@example.test", "Subject: Two", "", "two"].join("\r\n");

let close: (() => Promise<void>) | undefined;
afterEach(async () => {
  await close?.();
  close = undefined;
});

describe("openPop3", () => {
  it("lists, reads headers and bodies, and deletes on quit", async () => {
    const server = await createFakePop3Server({
      user: "box",
      password: "pw",
      messages: [first, second],
    });
    close = server.close;
    const mailbox = await openPop3({
      host: "127.0.0.1",
      port: server.port,
      tls: false,
      user: "box",
      password: "pw",
    });

    expect(await mailbox.list()).toEqual([
      { number: 1, uid: expect.stringMatching(/^uid-\d+-1$/) },
      { number: 2, uid: expect.stringMatching(/^uid-\d+-2$/) },
    ]);
    expect((await mailbox.headers(1)).toString("latin1")).toBe(
      "From: a@example.test\r\nSubject: One\r\n",
    );
    expect((await mailbox.retrieve(1)).toString("latin1")).toBe(`${first}\r\n`);
    await mailbox.remove(1);
    await mailbox.quit();

    expect(server.remaining()).toEqual([second]);
  });

  it("reports a message's size and refuses a response over the cap", async () => {
    const server = await createFakePop3Server({
      user: "box",
      password: "pw",
      messages: [first, `${second}\r\n${"x".repeat(2_000)}`],
    });
    close = server.close;
    const mailbox = await openPop3({
      host: "127.0.0.1",
      port: server.port,
      tls: false,
      user: "box",
      password: "pw",
      maxResponseBytes: 1_000,
    });
    expect(await mailbox.size(1)).toBe(Buffer.byteLength(first));
    await expect(mailbox.retrieve(2)).rejects.toThrow(
      "POP3 response too large",
    );
  });

  it("rejects a wrong password without reading mail", async () => {
    const server = await createFakePop3Server({
      user: "box",
      password: "pw",
      messages: [first],
    });
    close = server.close;
    await expect(
      openPop3({
        host: "127.0.0.1",
        port: server.port,
        tls: false,
        user: "box",
        password: "wrong",
      }),
    ).rejects.toThrow("POP3 login failed");
    expect(server.commands).not.toContain("UIDL");
  });
});
