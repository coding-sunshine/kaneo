import { strToU8, zipSync } from "fflate";
import { documentMarkdown } from "../document/controllers/export-document";
import { fileSlug } from "../export/file-slug";
import type { WorkspaceExport } from "./collect-workspace-export";

type Ticket = WorkspaceExport["tickets"][number];
type Message = WorkspaceExport["channelMessages"][number];

const day = (date: Date | null) => date?.toISOString().slice(0, 10) ?? "";
const cell = (text: string | null) =>
  (text ?? "").replace(/\|/g, "\\|").replace(/\s*\n\s*/g, " ");

function ticketMarkdown(ticket: Ticket) {
  const facts = [
    ["Team", ticket.team],
    ["Status", ticket.status],
    ["Priority", ticket.priority],
    ["Assignee", ticket.assignee ?? ""],
    ["Start date", day(ticket.startDate)],
    ["Due date", day(ticket.dueDate)],
    ["Archived", day(ticket.archivedAt)],
    ["Created", day(ticket.createdAt)],
  ].filter(([, value]) => value);
  return [
    `# ${ticket.key} ${ticket.title}`,
    "",
    "| Field | Value |",
    "| --- | --- |",
    ...facts.map(([field, value]) => `| ${field} | ${cell(value ?? "")} |`),
    "",
    ticket.description?.trim() ?? "",
    "",
  ].join("\n");
}

function channelMarkdown(messages: Message[]) {
  const [first] = messages;
  return [
    `# ${first?.channel ?? ""}`,
    "",
    ...messages.flatMap((message) => [
      `**${message.author ?? "Former member"}** · ${message.createdAt.toISOString()}`,
      "",
      message.body.trim(),
      "",
    ]),
  ].join("\n");
}

function usersMarkdown(users: WorkspaceExport["users"]) {
  return [
    "# Members",
    "",
    "| Name | Email | Role | Joined |",
    "| --- | --- | --- | --- |",
    ...users.map(
      (user) =>
        `| ${cell(user.name)} | ${cell(user.email)} | ${cell(user.role)} | ${day(user.joinedAt)} |`,
    ),
    "",
  ].join("\n");
}

const json = (value: unknown) => strToU8(`${JSON.stringify(value, null, 2)}\n`);

/**
 * The export as a zip: one JSON file per kind of record, and the same records
 * as Markdown. Entry names come from slugs and ids, never from raw titles.
 */
export function buildWorkspaceZip(data: WorkspaceExport, exportedAt: Date) {
  const files: Record<string, Uint8Array> = {
    "manifest.json": json({
      workspace: data.workspace,
      exportedAt: exportedAt.toISOString(),
      counts: {
        tickets: data.tickets.length,
        documents: data.documents.length,
        channelMessages: data.channelMessages.length,
        users: data.users.length,
      },
    }),
    "tickets.json": json(data.tickets),
    "documents.json": json(data.documents),
    "channel-messages.json": json(data.channelMessages),
    "users.json": json(data.users),
    "users.md": strToU8(usersMarkdown(data.users)),
  };
  for (const ticket of data.tickets) {
    files[`tickets/${fileSlug(ticket.key)}.md`] = strToU8(
      ticketMarkdown(ticket),
    );
  }
  for (const doc of data.documents) {
    files[`documents/${fileSlug(doc.title)}-${fileSlug(doc.id)}.md`] = strToU8(
      documentMarkdown(doc.title, doc.content),
    );
  }
  const channels = new Map<string, Message[]>();
  for (const message of data.channelMessages) {
    const list = channels.get(message.channelId) ?? [];
    list.push(message);
    channels.set(message.channelId, list);
  }
  for (const [channelId, messages] of channels) {
    const name = fileSlug(messages[0]?.channel ?? "", "channel");
    files[`channels/${name}-${fileSlug(channelId)}.md`] = strToU8(
      channelMarkdown(messages),
    );
  }
  return zipSync(files, { level: 6, mtime: exportedAt });
}
