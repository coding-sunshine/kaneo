export type ParsedEmail = {
  messageId: string | null;
  /** In-Reply-To first, then References newest first, without duplicates. */
  inReplyTo: string[];
  subject: string;
  from: { address: string; name: string | null } | null;
  recipients: string[];
  text: string;
  /** Auto-replies, bounces and bulk mail: answering them would start a loop. */
  automated: boolean;
};

type Part = { headers: Map<string, string>; body: Buffer };

const ADDRESS = /[^\s<>,;:"()[\]]+@[^\s<>,;:"()[\]]+/g;

function splitHeaders(raw: Buffer): Part {
  const text = raw.toString("latin1");
  const match = /\r?\n\r?\n/.exec(text);
  const head = match ? text.slice(0, match.index) : text;
  const looksLikeHeaders = /^[!-9;-~]+:/.test(head);
  if (!looksLikeHeaders) return { headers: new Map(), body: raw };
  const body = match
    ? raw.subarray(
        Buffer.byteLength(
          text.slice(0, match.index + match[0].length),
          "latin1",
        ),
      )
    : Buffer.alloc(0);
  const headers = new Map<string, string>();
  for (const line of head.replace(/\r?\n[ \t]+/g, " ").split(/\r?\n/)) {
    const colon = line.indexOf(":");
    if (colon <= 0) continue;
    const name = line.slice(0, colon).trim().toLowerCase();
    const value = line.slice(colon + 1).trim();
    // Repeated address headers (Cc, Delivered-To) all count.
    headers.set(
      name,
      headers.has(name) ? `${headers.get(name)}, ${value}` : value,
    );
  }
  return { headers, body };
}

// NUL is valid in mail but PostgreSQL text rejects it.
const withoutNul = (text: string) => text.replaceAll("\u0000", "");

function decodeCharset(bytes: Buffer, charset = "utf-8") {
  try {
    return withoutNul(new TextDecoder(charset.toLowerCase()).decode(bytes));
  } catch {
    return withoutNul(new TextDecoder("utf-8").decode(bytes));
  }
}

function decodeQuotedPrintable(text: string) {
  const bytes: number[] = [];
  const source = text.replace(/=\r?\n/g, "");
  for (let index = 0; index < source.length; index++) {
    const hex = source.slice(index + 1, index + 3);
    if (source[index] === "=" && /^[0-9A-Fa-f]{2}$/.test(hex)) {
      bytes.push(Number.parseInt(hex, 16));
      index += 2;
    } else {
      bytes.push(source.charCodeAt(index) & 0xff);
    }
  }
  return Buffer.from(bytes);
}

/** RFC 2047 encoded words in headers such as Subject and From. */
function decodeWords(value: string) {
  return value
    .replace(/(=\?[^?]+\?[BbQq]\?[^?]*\?=)\s+(?==\?)/g, "$1")
    .replace(
      /=\?([^?]+)\?([BbQq])\?([^?]*)\?=/g,
      (_word, charset: string, encoding: string, data: string) =>
        decodeCharset(
          encoding.toUpperCase() === "B"
            ? Buffer.from(data, "base64")
            : decodeQuotedPrintable(data.replaceAll("_", " ")),
          charset.split("*")[0],
        ),
    );
}

function parameter(header: string | undefined, name: string) {
  const match = new RegExp(
    `;\\s*${name}\\s*=\\s*("([^"]*)"|[^;\\s]+)`,
    "i",
  ).exec(header ?? "");
  return match ? (match[2] ?? match[1]) : undefined;
}

function decodeBody(part: Part) {
  const encoding = (
    part.headers.get("content-transfer-encoding") ?? ""
  ).toLowerCase();
  const raw = part.body.toString("latin1");
  const bytes =
    encoding === "base64"
      ? Buffer.from(raw.replace(/\s+/g, ""), "base64")
      : encoding === "quoted-printable"
        ? decodeQuotedPrintable(raw)
        : part.body;
  return decodeCharset(
    bytes,
    parameter(part.headers.get("content-type"), "charset"),
  );
}

function htmlToText(html: string) {
  return html
    .replace(/<(style|script|head)[\s\S]*?<\/\1>/gi, "")
    .replace(/<br\s*\/?>|<\/(p|div|li|tr|h[1-6])>/gi, "\n")
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/g, " ")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&amp;/g, "&");
}

// A hostile message cannot make parsing walk more than this.
const MAX_PARTS = 50;
const MAX_DEPTH = 5;
const MAX_TEXT = 100_000;

/** The first text/plain part, else the first text/html part as text. */
function findText(
  part: Part,
  budget = { parts: MAX_PARTS },
  depth = 0,
): { plain?: string; html?: string } {
  const type = (part.headers.get("content-type") ?? "text/plain")
    .split(";")[0]
    ?.trim()
    .toLowerCase();
  const disposition = part.headers.get("content-disposition") ?? "";
  if (/^attachment/i.test(disposition)) return {};
  if (type === "text/plain")
    return { plain: decodeBody(part).slice(0, MAX_TEXT) };
  if (type === "text/html")
    return { html: htmlToText(decodeBody(part).slice(0, MAX_TEXT)) };
  const boundary = parameter(part.headers.get("content-type"), "boundary");
  if (!type?.startsWith("multipart/") || !boundary || depth >= MAX_DEPTH)
    return {};

  const found: { plain?: string; html?: string } = {};
  const body = part.body.toString("latin1");
  const delimiter = `--${boundary}`;
  const sections = body.split(
    new RegExp(`\\r?\\n?${delimiter.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}`),
  );
  for (const section of sections.slice(1)) {
    if (section.startsWith("--") || budget.parts <= 0) break;
    budget.parts -= 1;
    const child = splitHeaders(
      Buffer.from(section.replace(/^\r?\n/, ""), "latin1"),
    );
    const text = findText(child, budget, depth + 1);
    found.plain ??= text.plain;
    found.html ??= text.html;
    if (found.plain) break;
  }
  return found;
}

function messageIds(value: string | undefined) {
  return value?.match(/<[^<>\s]+>/g) ?? [];
}

function parseFrom(value: string | undefined): ParsedEmail["from"] {
  if (!value) return null;
  const decoded = withoutNul(decodeWords(value));
  const address = decoded.match(ADDRESS)?.[0];
  if (!address) return null;
  const name = decoded
    .replace(/<[^>]*>/, "")
    .replace(address, "")
    .replace(/^[\s"']+|[\s"']+$/g, "");
  return { address: address.toLowerCase(), name: name || null };
}

/**
 * Reads the parts of an RFC 5322 message that a ticket needs. It is not a full
 * MIME parser: attachments are skipped and only the first text body is kept.
 */
export function parseEmail(raw: Buffer | string): ParsedEmail {
  const message = splitHeaders(
    typeof raw === "string" ? Buffer.from(raw, "utf8") : raw,
  );
  const header = (name: string) => message.headers.get(name);
  const { plain, html } = findText(message);
  const recipients = ["to", "cc", "delivered-to", "x-original-to"].flatMap(
    (name) => header(name)?.match(ADDRESS) ?? [],
  );
  const autoSubmitted = (header("auto-submitted") ?? "no").toLowerCase();
  const precedence = (header("precedence") ?? "").toLowerCase();
  const from = parseFrom(header("from"));
  // Bounces and delivery reports: answering them would loop.
  const bounce =
    /^(mailer-daemon|postmaster)@/.test(from?.address ?? "") ||
    /^<\s*>$/.test(header("return-path") ?? "") ||
    /^multipart\/report\b/i.test(header("content-type") ?? "");

  return {
    messageId: messageIds(header("message-id"))[0] ?? null,
    inReplyTo: [
      ...new Set([
        ...messageIds(header("in-reply-to")),
        ...messageIds(header("references")).reverse(),
      ]),
    ],
    subject: withoutNul(decodeWords(header("subject") ?? "")).trim(),
    from,
    recipients: [
      ...new Set(recipients.map((address) => address.toLowerCase())),
    ],
    text: (plain ?? html ?? "")
      .replace(/\r\n/g, "\n")
      .replace(/\n{3,}/g, "\n\n")
      .trim(),
    automated:
      bounce ||
      autoSubmitted !== "no" ||
      ["bulk", "junk", "list", "auto_reply"].includes(precedence) ||
      Boolean(header("x-autoreply") ?? header("x-autorespond")),
  };
}
