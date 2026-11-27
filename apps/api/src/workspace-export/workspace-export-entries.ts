import { documentMarkdown } from "../document/controllers/export-document";
import { fileSlug } from "../export/file-slug";
import {
  channelHeading,
  MEMBERS_HEADING,
  memberRow,
  messageMarkdown,
  ticketMarkdown,
} from "./export-markdown";
import {
  channelPage,
  documentPage,
  type ExportChannel,
  type ExportMember,
  type ExportMessage,
  type ExportReader,
  type MessageCursor,
  memberPage,
  messagePage,
  ticketPage,
} from "./export-queries";
import { pagedRows } from "./paged-rows";
import type { ZipEntry } from "./zip-chunks";

const PAGE = 500;
// Documents carry their whole text, so fewer of them fit in one page.
const DOCUMENT_PAGE = 50;

const byId = (row: { id: string }) => row.id;

const tickets = (reader: ExportReader) =>
  pagedRows((after, size) => ticketPage(reader, after, size), byId, PAGE);
const documents = (reader: ExportReader) =>
  pagedRows(
    (after, size) => documentPage(reader, after, size),
    byId,
    DOCUMENT_PAGE,
  );
const channels = (reader: ExportReader) =>
  pagedRows((after, size) => channelPage(reader, after, size), byId, PAGE);
const messages = (channel: ExportChannel) =>
  pagedRows<ExportMessage, MessageCursor>(
    (after, size) => messagePage(channel.id, after, size),
    (row) => ({ at: row.cursor, id: row.id }),
    PAGE,
  );
const members = (reader: ExportReader) =>
  pagedRows<ExportMember, string>(
    (after, size) => memberPage(reader, after, size),
    (row) => row.memberId,
    PAGE,
  );

// A JSON array written one row at a time; `count` runs once per row.
async function* jsonArray<Row>(rows: AsyncIterable<Row>, count: () => void) {
  let first = true;
  yield "[";
  for await (const row of rows) {
    count();
    yield `${first ? "\n" : ",\n"}${JSON.stringify(row, null, 2)}`;
    first = false;
  }
  yield first ? "]\n" : "\n]\n";
}

async function* channelMessages(reader: ExportReader) {
  for await (const channel of channels(reader)) {
    for await (const { cursor: _, ...message } of messages(channel)) {
      yield {
        ...message,
        channelId: channel.id,
        channel: channel.name,
        direct: channel.direct,
      };
    }
  }
}

/**
 * The files of a workspace export, in zip order. Each kind is read once for
 * its JSON file and again for its Markdown files, a page at a time, and the
 * manifest comes last with the counts of the JSON files.
 */
export async function* workspaceExportEntries(
  reader: ExportReader,
  workspace: { id: string; name: string },
  exportedAt: Date,
): AsyncGenerator<ZipEntry> {
  const counts = { tickets: 0, documents: 0, channelMessages: 0, users: 0 };

  yield {
    name: "tickets.json",
    parts: jsonArray(tickets(reader), () => counts.tickets++),
  };
  for await (const ticket of tickets(reader)) {
    yield {
      name: `tickets/${fileSlug(ticket.key)}.md`,
      parts: [ticketMarkdown(ticket)],
    };
  }

  yield {
    name: "documents.json",
    parts: jsonArray(documents(reader), () => counts.documents++),
  };
  for await (const doc of documents(reader)) {
    yield {
      name: `documents/${fileSlug(doc.title)}-${fileSlug(doc.id)}.md`,
      parts: [documentMarkdown(doc.title, doc.content)],
    };
  }

  yield {
    name: "channel-messages.json",
    parts: jsonArray(channelMessages(reader), () => counts.channelMessages++),
  };
  for await (const channel of channels(reader)) {
    const rows = messages(channel);
    const first = await rows.next();
    if (first.done) continue;
    yield {
      name: `channels/${fileSlug(channel.name, "channel")}-${fileSlug(channel.id)}.md`,
      parts: (async function* () {
        yield channelHeading(channel);
        yield messageMarkdown(first.value);
        for await (const message of rows) yield messageMarkdown(message);
      })(),
    };
  }

  const users = async function* () {
    for await (const { memberId: _, ...user } of members(reader)) yield user;
  };
  yield {
    name: "users.json",
    parts: jsonArray(users(), () => counts.users++),
  };
  yield {
    name: "users.md",
    parts: (async function* () {
      yield MEMBERS_HEADING;
      for await (const member of members(reader)) yield memberRow(member);
    })(),
  };

  yield {
    name: "manifest.json",
    parts: [
      `${JSON.stringify(
        { workspace, exportedAt: exportedAt.toISOString(), counts },
        null,
        2,
      )}\n`,
    ],
  };
}
