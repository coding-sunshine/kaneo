import { afterEach, describe, expect, it, vi } from "vite-plus/test";
import { sendTicketReplyEmail } from "./send-email";

const smtp = vi.hoisted(() => ({ sendMail: vi.fn() }));
vi.mock("nodemailer", () => ({
  createTransport: () => ({ sendMail: smtp.sendMail }),
}));
vi.mock("dotenv-mono", () => ({ config: () => {} }));

const reply = {
  to: "requester@example.test",
  replyTo: "help+abc123@intake.example.test",
  subject: "Re: Printer",
  text: "We restarted it.",
  messageId: "<out-1@intake.example.test>",
  inReplyTo: "<first@example.test>",
  references: ["<first@example.test>"],
};

describe("sendTicketReplyEmail", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    smtp.sendMail.mockReset();
  });

  it("sends in the requester's thread with the team address as Reply-To", async () => {
    vi.stubEnv("SMTP_HOST", "smtp.example.test");
    vi.stubEnv("SMTP_FROM", "kaneo@example.test");

    await expect(sendTicketReplyEmail(reply)).resolves.toEqual({
      success: true,
    });
    expect(smtp.sendMail).toHaveBeenCalledWith({
      from: "kaneo@example.test",
      to: "requester@example.test",
      replyTo: "help+abc123@intake.example.test",
      subject: "Re: Printer",
      text: "We restarted it.",
      messageId: "<out-1@intake.example.test>",
      inReplyTo: "<first@example.test>",
      references: ["<first@example.test>"],
    });
  });

  it("reports SMTP as missing instead of sending", async () => {
    vi.stubEnv("SMTP_HOST", "");
    await expect(sendTicketReplyEmail(reply)).resolves.toEqual({
      success: false,
      reason: "SMTP_NOT_CONFIGURED",
    });
    expect(smtp.sendMail).not.toHaveBeenCalled();
  });
});
