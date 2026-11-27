import { createHash } from "node:crypto";
import { and, eq, inArray } from "drizzle-orm";
import db from "../database";
import {
  activityTable,
  emailIntakeMessageTable,
  emailIntakeTable,
  taskTable,
} from "../database/schema";
import { publishEvent } from "../events";
import { claimTaskNumber } from "../task/controllers/claim-task-numbers";
import { nextTaskPosition } from "../task/controllers/next-task-position";
import { ensureTriageColumn } from "../team-automation/ensure-triage-column";
import { addressedTokens, type EmailIntakeConfig } from "./config";
import { hashIntakeToken, sameIntakeToken } from "./intake-token";
import { parseEmail } from "./parse-email";
import { stripQuotedReply } from "./strip-quoted-reply";

const MAX_TITLE = 200;
const MAX_DESCRIPTION = 20_000;
const MAX_COMMENT = 10_000;

export type IngestResult = { tickets: string[]; replies: string[] };

function ownAddress(config: EmailIntakeConfig, address: string) {
  const smtpFrom = process.env.SMTP_FROM?.match(/[^\s<>"]+@[^\s<>"]+/)?.[0];
  return (
    (address.endsWith(`@${config.domain}`) &&
      (address.startsWith(`${config.local}@`) ||
        address.startsWith(`${config.local}+`))) ||
    address === smtpFrom?.toLowerCase()
  );
}

/**
 * Files one received message. Mail to a team address opens a Triage ticket,
 * or, when it answers a message of a ticket's thread, becomes a comment on
 * that ticket. The sender is a stranger, so their text is stored as written
 * and never resolves mentions, links or references with anyone's access.
 */
export async function ingestEmail(
  raw: Buffer,
  config: EmailIntakeConfig,
): Promise<IngestResult> {
  const result: IngestResult = { tickets: [], replies: [] };
  const email = parseEmail(raw);
  if (!email.from || email.automated || ownAddress(config, email.from.address))
    return result;
  const tokens = addressedTokens(config, email.recipients);
  if (tokens.length === 0) return result;

  const rows = await db
    .select({
      projectId: emailIntakeTable.projectId,
      token: emailIntakeTable.token,
    })
    .from(emailIntakeTable)
    .where(inArray(emailIntakeTable.tokenHash, tokens.map(hashIntakeToken)));
  const intakes = rows.filter((row) =>
    tokens.some((token) => sameIntakeToken(row.token, token)),
  );
  const messageId =
    email.messageId ??
    `<${createHash("sha256").update(raw).digest("hex")}@missing-message-id>`;
  const from = email.from;
  const subject = email.subject.slice(0, MAX_TITLE);

  for (const { projectId } of intakes) {
    const [seen] = await db
      .select({ id: emailIntakeMessageTable.id })
      .from(emailIntakeMessageTable)
      .where(
        and(
          eq(emailIntakeMessageTable.projectId, projectId),
          eq(emailIntakeMessageTable.messageId, messageId),
        ),
      );
    if (seen) continue;

    const [thread] = email.inReplyTo.length
      ? await db
          .select({ taskId: emailIntakeMessageTable.taskId })
          .from(emailIntakeMessageTable)
          // The ticket must still be on this team; one moved away starts anew.
          .innerJoin(
            taskTable,
            eq(taskTable.id, emailIntakeMessageTable.taskId),
          )
          .where(
            and(
              eq(emailIntakeMessageTable.projectId, projectId),
              eq(taskTable.projectId, projectId),
              // Only ids this server made: a sender picks their own
              // Message-ID, so matching those would let anyone who knows one
              // post into another requester's ticket.
              eq(emailIntakeMessageTable.direction, "outbound"),
              eq(emailIntakeMessageTable.status, "sent"),
              inArray(emailIntakeMessageTable.messageId, email.inReplyTo),
            ),
          )
          .limit(1)
      : [];
    const record = {
      projectId,
      messageId,
      direction: "inbound",
      address: from.address,
      name: from.name,
      subject,
    };

    if (thread) {
      const comment = await db.transaction(async (tx) => {
        await tx
          .insert(emailIntakeMessageTable)
          .values({ ...record, taskId: thread.taskId });
        const [activity] = await tx
          .insert(activityTable)
          .values({
            taskId: thread.taskId,
            type: "comment",
            content:
              stripQuotedReply(email.text).slice(0, MAX_COMMENT) || subject,
            externalUserName: from.name ?? from.address,
            externalSource: "email",
          })
          .returning({ id: activityTable.id });
        return activity;
      });
      // Not comment.created: integrations would copy the requester's mail
      // into linked GitHub or chat threads.
      await publishEvent("comment.updated", {
        id: comment?.id,
        taskId: thread.taskId,
        projectId,
        userId: null,
      });
      result.replies.push(thread.taskId);
      continue;
    }

    const task = await db.transaction(async (tx) => {
      const columnId = await ensureTriageColumn(tx, projectId);
      const number = await claimTaskNumber(projectId, tx);
      const position = await nextTaskPosition(
        tx,
        projectId,
        "triage",
        columnId ?? null,
      );
      const [created] = await tx
        .insert(taskTable)
        .values({
          projectId,
          title: subject || `Email from ${from.address}`,
          description: email.text.slice(0, MAX_DESCRIPTION),
          status: "triage",
          columnId: columnId ?? null,
          priority: "no-priority",
          number,
          position,
        })
        .returning();
      if (!created) throw new Error("Failed to file the email as a ticket");
      await tx
        .insert(emailIntakeMessageTable)
        .values({ ...record, taskId: created.id });
      return created;
    });
    await publishEvent("task.created", {
      ...task,
      taskId: task.id,
      userId: "",
      type: "task",
      content: null,
      source: "email",
    });
    result.tickets.push(task.id);
  }
  return result;
}
