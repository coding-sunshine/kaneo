import { createId } from "@paralleldrive/cuid2";
import { getSmtpErrorDetails, sendTicketReplyEmail } from "@kaneo/email";
import { and, asc, eq } from "drizzle-orm";
import createComment from "../activity/controllers/create-comment";
import deleteComment from "../activity/controllers/delete-comment";
import db from "../database";
import {
  emailIntakeMessageTable,
  emailIntakeTable,
  taskTable,
} from "../database/schema";
import { ApiError } from "../errors/api-error";
import { readEmailIntakeConfig, teamIntakeAddress } from "./config";
import { intakeOff } from "./team-intake";

/** The requester of an emailed ticket: whoever wrote to the team last. */
export async function getTicketThread(taskId: string) {
  const messages = await db
    .select({
      direction: emailIntakeMessageTable.direction,
      messageId: emailIntakeMessageTable.messageId,
      address: emailIntakeMessageTable.address,
      name: emailIntakeMessageTable.name,
      subject: emailIntakeMessageTable.subject,
    })
    .from(emailIntakeMessageTable)
    .where(
      and(
        eq(emailIntakeMessageTable.taskId, taskId),
        eq(emailIntakeMessageTable.status, "sent"),
      ),
    )
    .orderBy(
      asc(emailIntakeMessageTable.createdAt),
      asc(emailIntakeMessageTable.id),
    );
  const requester = messages
    .filter((message) => message.direction === "inbound")
    .at(-1);
  return requester ? { messages, requester } : null;
}

/**
 * Emails a team member's answer to the ticket's requester, in their thread,
 * and records it as the member's comment on the ticket.
 */
export async function sendTicketReply(
  taskId: string,
  userId: string,
  content: string,
) {
  const config = readEmailIntakeConfig();
  if (!config) throw intakeOff();
  const [task] = await db
    .select({ projectId: taskTable.projectId, token: emailIntakeTable.token })
    .from(taskTable)
    .leftJoin(
      emailIntakeTable,
      eq(emailIntakeTable.projectId, taskTable.projectId),
    )
    .where(eq(taskTable.id, taskId));
  if (!task)
    throw new ApiError(404, { message: "Task not found", code: "NOT_FOUND" });
  if (!task.token)
    throw new ApiError(409, {
      message:
        "Email intake is off for this team, so replies have no address to come back to.",
      code: "EMAIL_INTAKE_OFF",
    });
  const thread = await getTicketThread(taskId);
  if (!thread)
    throw new ApiError(404, {
      message: "This ticket did not come in by email",
      code: "NO_EMAIL_THREAD",
    });

  const { requester, messages } = thread;
  const subject = /^re:/i.test(requester.subject)
    ? requester.subject
    : `Re: ${requester.subject}`;
  const messageId = `<${createId()}@${config.domain}>`;
  const ids = messages.map((message) => message.messageId);

  // Record the reply first, so a reply that went out always has its comment.
  const [pending] = await db
    .insert(emailIntakeMessageTable)
    .values({
      projectId: task.projectId,
      taskId,
      messageId,
      direction: "outbound",
      status: "pending",
      address: requester.address,
      name: requester.name,
      subject,
    })
    .returning({ id: emailIntakeMessageTable.id });
  if (!pending) throw new Error("Failed to record the ticket reply");
  const withdraw = async (commentId?: string) => {
    if (commentId) await deleteComment(userId, commentId);
    await db
      .delete(emailIntakeMessageTable)
      .where(eq(emailIntakeMessageTable.id, pending.id));
  };

  let commentId: string | undefined;
  let sent: Awaited<ReturnType<typeof sendTicketReplyEmail>>;
  try {
    commentId = (await createComment(taskId, userId, content)).id;
    sent = await sendTicketReplyEmail({
      to: requester.address,
      replyTo: teamIntakeAddress(config, task.token),
      subject,
      text: content,
      messageId,
      inReplyTo: ids.at(-1) ?? "",
      references: ids.slice(-20),
    });
  } catch (error) {
    await withdraw(commentId);
    if (!commentId) throw error;
    console.error("Error sending a ticket reply", getSmtpErrorDetails(error));
    throw new ApiError(502, {
      message:
        "The mail server did not accept the reply. Check the SMTP settings and the API logs.",
      code: "SMTP_SEND_FAILED",
    });
  }
  if (!sent.success) {
    await withdraw(commentId);
    throw new ApiError(409, {
      message:
        "This instance cannot send email. An administrator must set SMTP_HOST and SMTP_FROM.",
      code: "SMTP_NOT_CONFIGURED",
    });
  }

  await db
    .update(emailIntakeMessageTable)
    .set({ status: "sent" })
    .where(eq(emailIntakeMessageTable.id, pending.id));
  return { to: requester.address, commentId };
}
