import type {
  ExportChannel,
  ExportMember,
  ExportMessage,
  ExportTicket,
} from "./export-queries";

const day = (date: Date | null) => date?.toISOString().slice(0, 10) ?? "";
const cell = (text: string | null) =>
  (text ?? "").replace(/\|/g, "\\|").replace(/\s*\n\s*/g, " ");

export function ticketMarkdown(ticket: ExportTicket) {
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

export const channelHeading = (channel: ExportChannel) =>
  `# ${channel.name}\n\n`;

export const messageMarkdown = (message: ExportMessage) =>
  `**${message.author ?? "Former member"}** · ${message.createdAt.toISOString()}\n\n${message.body.trim()}\n\n`;

export const MEMBERS_HEADING =
  "# Members\n\n| Name | Email | Role | Joined |\n| --- | --- | --- | --- |\n";

export const memberRow = (member: ExportMember) =>
  `| ${cell(member.name)} | ${cell(member.email)} | ${cell(member.role)} | ${day(member.joinedAt)} |\n`;
