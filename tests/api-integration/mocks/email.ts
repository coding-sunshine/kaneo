import type { EmailSubject } from "../../../packages/email/src/brand";
import type { EmailResult } from "../../../packages/email/src/send-email";
import type { SmtpVerification } from "../../../packages/email/src/verify-smtp-connection";

export { OTP_EXPIRY_SECONDS } from "../../../packages/email/src/otp-expiry";
export { getSmtpErrorDetails } from "../../../packages/email/src/smtp-error-details";

export async function sendMagicLinkEmail(
  _to: string,
  _subject: EmailSubject,
  _data: unknown,
): Promise<void> {
  return undefined;
}

export async function sendOtpEmail(
  _to: string,
  _subject: EmailSubject,
  _data: unknown,
): Promise<void> {
  return undefined;
}

export async function sendWorkspaceInvitationEmail(
  _to: string,
  _subject: EmailSubject,
  _data: unknown,
): Promise<EmailResult> {
  return { success: true };
}

export function isSmtpConfigured(): boolean {
  return false;
}

export async function sendPasswordResetEmail(
  _to: string,
  _subject: EmailSubject,
  _data: unknown,
): Promise<void> {
  return undefined;
}

export async function sendAccountPasswordEmail(
  _to: string,
  _subject: EmailSubject,
  _data: unknown,
): Promise<EmailResult> {
  return { success: true };
}

export async function sendEmailVerificationEmail(
  _to: string,
  _subject: EmailSubject,
  _data: unknown,
): Promise<EmailResult> {
  return { success: true };
}

export async function sendTestEmail(
  _to: string,
  _subject: EmailSubject,
  _data: unknown,
): Promise<EmailResult> {
  return { success: false, reason: "SMTP_NOT_CONFIGURED" };
}

export async function verifySmtpConnection(
  _timeoutMs: number,
): Promise<SmtpVerification> {
  return { status: "not_configured" };
}

export function setBrandNameResolver(
  _resolver: () => Promise<string | null | undefined>,
): void {}

// Ticket replies the API asked to send, newest last, so tests can answer them.
export const sentTicketReplies: Array<{
  to: string;
  replyTo: string;
  subject: string;
  text: string;
  messageId: string;
  inReplyTo: string;
  references: string[];
}> = [];

// Set `failWith` to make the next sends throw like a rejecting SMTP server;
// `beforeSend` runs first, so a test can look at the database mid-send.
export const ticketReplyTransport: {
  failWith: Error | null;
  beforeSend: (() => Promise<void>) | null;
} = { failWith: null, beforeSend: null };

export async function sendTicketReplyEmail(
  email: (typeof sentTicketReplies)[number],
): Promise<EmailResult> {
  await ticketReplyTransport.beforeSend?.();
  if (ticketReplyTransport.failWith) throw ticketReplyTransport.failWith;
  sentTicketReplies.push(email);
  return { success: true };
}
