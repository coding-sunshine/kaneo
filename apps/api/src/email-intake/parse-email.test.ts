import { describe, expect, it } from "vite-plus/test";
import { parseEmail } from "./parse-email";

const crlf = (lines: string[]) => lines.join("\r\n");

describe("parseEmail", () => {
  it("reads a plain message", () => {
    const email = parseEmail(
      crlf([
        'From: "Sam Requester" <sam@example.test>',
        "To: help+abc123@intake.example.test",
        "Subject: Printer is",
        " on fire",
        "Message-ID: <first@example.test>",
        "",
        "It smokes.",
        "Please help.",
      ]),
    );
    expect(email).toMatchObject({
      messageId: "<first@example.test>",
      subject: "Printer is on fire",
      from: { address: "sam@example.test", name: "Sam Requester" },
      recipients: ["help+abc123@intake.example.test"],
      text: "It smokes.\nPlease help.",
      inReplyTo: [],
      automated: false,
    });
  });

  it("decodes encoded words, quoted-printable and multipart bodies", () => {
    const email = parseEmail(
      crlf([
        "From: =?UTF-8?B?SsO8cmdlbg==?= <j@example.test>",
        "To: Help <help+abc123@intake.example.test>, other@example.test",
        "Cc: help+def456@intake.example.test",
        "Subject: =?utf-8?Q?Caf=C3=A9_order?=",
        "In-Reply-To: <a@x.test>",
        "References: <root@x.test> <a@x.test>",
        'Content-Type: multipart/alternative; boundary="b1"',
        "",
        "--b1",
        "Content-Type: text/plain; charset=utf-8",
        "Content-Transfer-Encoding: quoted-printable",
        "",
        "Caf=C3=A9 au lait, s'il vous pla=",
        "=C3=AEt.",
        "--b1",
        "Content-Type: text/html",
        "",
        "<p>ignored</p>",
        "--b1--",
      ]),
    );
    expect(email.from).toEqual({ address: "j@example.test", name: "Jürgen" });
    expect(email.subject).toBe("Café order");
    expect(email.text).toBe("Café au lait, s'il vous plaît.");
    expect(email.recipients).toEqual([
      "help+abc123@intake.example.test",
      "other@example.test",
      "help+def456@intake.example.test",
    ]);
    expect(email.inReplyTo).toEqual(["<a@x.test>", "<root@x.test>"]);
  });

  it("falls back to the HTML part as text and decodes base64", () => {
    const html = Buffer.from(
      "<div>Hello<br>there &amp; you</div><style>p{}</style>",
    ).toString("base64");
    const email = parseEmail(
      crlf([
        "From: a@example.test",
        "Subject: Hi",
        'Content-Type: multipart/mixed; boundary="outer"',
        "",
        "--outer",
        "Content-Type: text/html; charset=utf-8",
        "Content-Transfer-Encoding: base64",
        "",
        html,
        "--outer--",
      ]),
    );
    expect(email.text).toBe("Hello\nthere & you");
  });

  it("flags auto-replies and bulk mail", () => {
    expect(
      parseEmail(
        crlf(["From: a@example.test", "Auto-Submitted: auto-replied", "", "x"]),
      ).automated,
    ).toBe(true);
    expect(
      parseEmail(crlf(["From: a@example.test", "Precedence: bulk", "", "x"]))
        .automated,
    ).toBe(true);
    expect(
      parseEmail(crlf(["From: a@example.test", "Auto-Submitted: no", "", "x"]))
        .automated,
    ).toBe(false);
  });

  it("drops NUL characters, which the database rejects", () => {
    const email = parseEmail(
      crlf([
        "From: A\u0000B <a@example.test>",
        "Subject: x\u0000y",
        "",
        "b\u0000c",
      ]),
    );
    expect(email).toMatchObject({ subject: "xy", text: "bc" });
    expect(email.from?.name).toBe("AB");
  });

  it("flags bounces and delivery reports", () => {
    const bounce = (headers: string[]) =>
      parseEmail(crlf([...headers, "", "x"])).automated;
    expect(bounce(["From: MAILER-DAEMON@mx.example.test"])).toBe(true);
    expect(bounce(["From: Mail System <postmaster@mx.example.test>"])).toBe(
      true,
    );
    expect(bounce(["From: a@example.test", "Return-Path: <>"])).toBe(true);
    expect(
      bounce([
        "From: a@example.test",
        'Content-Type: multipart/report; report-type=delivery-status; boundary="r"',
      ]),
    ).toBe(true);
    expect(
      bounce(["From: a@example.test", "Return-Path: <a@example.test>"]),
    ).toBe(false);
  });

  it("stops after 50 parts and 5 levels of nesting", () => {
    const parts = Array.from({ length: 60 }, (_, index) =>
      index === 55
        ? ["--b", "Content-Type: text/plain", "", "too late"]
        : ["--b", "Content-Type: image/png", "", "x"],
    ).flat();
    expect(
      parseEmail(
        crlf([
          "From: a@example.test",
          'Content-Type: multipart/mixed; boundary="b"',
          "",
          ...parts,
          "--b--",
        ]),
      ).text,
    ).toBe("");

    let nested = ["Content-Type: text/plain", "", "deep"];
    for (let level = 0; level < 8; level++) {
      nested = [
        `Content-Type: multipart/mixed; boundary="n${level}"`,
        "",
        `--n${level}`,
        ...nested,
        `--n${level}--`,
      ];
    }
    expect(parseEmail(crlf(["From: a@example.test", ...nested])).text).toBe("");
  });

  it("keeps the body text bounded", () => {
    const text = parseEmail(
      crlf([
        "From: a@example.test",
        "Content-Type: text/html",
        "",
        "<style>".repeat(50_000),
      ]),
    ).text;
    expect(text.length).toBeLessThanOrEqual(100_000);
  });

  it("copes with a message that has no headers it needs", () => {
    expect(parseEmail("just text")).toMatchObject({
      messageId: null,
      subject: "",
      from: null,
      recipients: [],
    });
  });
});
