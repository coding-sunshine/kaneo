import { TICKET_ID_PATTERN } from "../task/ticket-id";

// ponytail: a text links at most this many documents or issues; the rest are
// ignored. Raise it if a real index page needs more.
const LIMIT = 200;
// The largest issue number has nine digits, so it always fits the column.
const NUMBER = /^\d{1,9}$/;

const DOCUMENT_ADDRESS =
  /\/workspace\/([^/\s"'<>()]+)\/document\/([a-z0-9]+)(?![\w-])/g;
// A team's own pages. The address of a ticket names the ticket, not its team.
const PROJECT_ADDRESS =
  /\/workspace\/([^/\s"'<>()]+)\/project\/([a-z0-9]+)(?![\w-])(?!\/task\/)/g;
const TASK_ADDRESS = /\/task\/([^/\s"'<>()?#]+)/g;
// ponytail: a typed key is letters and digits only. A key with other
// characters is linked through the address of its issue. A percent sign in
// front means an encoded address, which is read as an address.
const TYPED_KEY =
  /(?<![\p{L}\p{N}_%-])(\p{L}[\p{L}\p{N}]*)-(\d{1,9})(?![\p{L}\p{N}_-])/gu;

export type TaskReferences = {
  ids: string[];
  keys: { key: string; number: number }[];
};

/** Whether a text can hold the address of a document. No lookup, so cheap. */
export const mentionsDocument = (text: string | null | undefined) =>
  Boolean(text?.includes("/document/"));

/** The documents of one workspace that a text links to by their address. */
export function findDocumentIds(text: string, workspaceId: string) {
  const ids = new Set<string>();
  for (const [, workspace, id] of text.matchAll(DOCUMENT_ADDRESS)) {
    if (workspace === workspaceId && id && ids.size < LIMIT) ids.add(id);
  }
  return [...ids];
}

/** The teams of one workspace that a text links to by their address. */
export function findProjectIds(text: string, workspaceId: string) {
  const ids = new Set<string>();
  for (const [, workspace, id] of text.matchAll(PROJECT_ADDRESS)) {
    if (workspace === workspaceId && id && ids.size < LIMIT) ids.add(id);
  }
  return [...ids];
}

const decoded = (segment: string) => {
  try {
    return decodeURIComponent(segment);
  } catch {
    return segment;
  }
};

/**
 * The issues a text names: by the address of the issue, which carries its id
 * or its key, and by a key typed into the words. Exact matches only: what a
 * name means is decided by the lookup, never guessed.
 */
export function findTaskReferences(text: string): TaskReferences {
  const ids = new Set<string>();
  const keys = new Map<string, { key: string; number: number }>();
  const addKey = (key: string, digits: string) => {
    if (!NUMBER.test(digits) || keys.size >= LIMIT) return;
    const number = Number(digits);
    keys.set(`${key.normalize("NFKC").toLowerCase()}-${number}`, {
      key,
      number,
    });
  };

  for (const [, segment = ""] of text.matchAll(TASK_ADDRESS)) {
    const ticket = TICKET_ID_PATTERN.exec(decoded(segment));
    if (ticket?.[1] && ticket[2]) addKey(ticket[1], ticket[2]);
    else if (/^[a-z0-9]+$/.test(segment) && ids.size < LIMIT) ids.add(segment);
  }
  // Markup is not words: a class name or an attribute never names an issue.
  const words = text.replace(/<[^>]*>/g, " ");
  for (const [, key = "", digits = ""] of words.matchAll(TYPED_KEY)) {
    addKey(key, digits);
  }
  return { ids: [...ids], keys: [...keys.values()] };
}
