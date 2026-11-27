import { and, asc, desc, eq } from "drizzle-orm";
import { HTTPException } from "hono/http-exception";
import db from "../database";
import { agentChatTable, agentMessageTable } from "../database/schema";
import { assertWithinBudget } from "./budget";
import { type ChatMessage } from "./openrouter";
import { type AgentEvent, runAgent } from "./run-agent";
import { createSelfClient, forwardedAuthHeaders } from "./self-client";

export const listChats = (userId: string, workspaceId: string) =>
  db
    .select({
      id: agentChatTable.id,
      title: agentChatTable.title,
      updatedAt: agentChatTable.updatedAt,
    })
    .from(agentChatTable)
    .where(
      and(
        eq(agentChatTable.userId, userId),
        eq(agentChatTable.workspaceId, workspaceId),
      ),
    )
    .orderBy(desc(agentChatTable.updatedAt))
    .limit(100);

// Chats are private: a chat id from another user or workspace is a 404.
async function getOwnChat(userId: string, workspaceId: string, chatId: string) {
  const [chat] = await db
    .select()
    .from(agentChatTable)
    .where(
      and(
        eq(agentChatTable.id, chatId),
        eq(agentChatTable.userId, userId),
        eq(agentChatTable.workspaceId, workspaceId),
      ),
    );
  if (!chat) throw new HTTPException(404, { message: "Chat not found" });
  return chat;
}

async function chatMessages(chatId: string) {
  const rows = await db
    .select({ message: agentMessageTable.message })
    .from(agentMessageTable)
    .where(eq(agentMessageTable.chatId, chatId))
    .orderBy(asc(agentMessageTable.seq));
  return rows.map((row) => row.message);
}

export async function getChat(
  userId: string,
  workspaceId: string,
  chatId: string,
) {
  const chat = await getOwnChat(userId, workspaceId, chatId);
  return {
    id: chat.id,
    title: chat.title,
    messages: await chatMessages(chat.id),
  };
}

export async function deleteChat(
  userId: string,
  workspaceId: string,
  chatId: string,
) {
  await getOwnChat(userId, workspaceId, chatId);
  await db.delete(agentChatTable).where(eq(agentChatTable.id, chatId));
  return { id: chatId };
}

const saveMessages = (chatId: string, messages: ChatMessage[]) =>
  db
    .insert(agentMessageTable)
    .values(messages.map((message) => ({ chatId, message })));

export async function sendMessage(
  userId: string,
  workspaceId: string,
  requestHeaders: Headers,
  body: { chatId?: string; message: string },
  onEvent?: (
    event: AgentEvent | { type: "chat"; chatId: string; title: string },
  ) => void,
) {
  // A spent budget refuses the question before a chat or message is saved.
  await assertWithinBudget(workspaceId, userId);
  const chat = body.chatId
    ? await getOwnChat(userId, workspaceId, body.chatId)
    : (
        await db
          .insert(agentChatTable)
          .values({
            userId,
            workspaceId,
            title: body.message.replace(/\s+/g, " ").slice(0, 60),
          })
          .returning()
      )[0];
  if (!chat) throw new HTTPException(500, { message: "Chat not created" });

  onEvent?.({ type: "chat", chatId: chat.id, title: chat.title });
  const history = await chatMessages(chat.id);
  const userMessage: ChatMessage = { role: "user", content: body.message };
  // Saved before the model runs so a failed run keeps the question.
  await saveMessages(chat.id, [userMessage]);

  let added: ChatMessage[];
  try {
    added = await runAgent(
      [...history, userMessage],
      createSelfClient(forwardedAuthHeaders(requestHeaders)),
      workspaceId,
      onEvent,
      { meter: { userId, purpose: "assistant" } },
    );
  } catch (error) {
    if (error instanceof HTTPException) throw error;
    throw new HTTPException(502, {
      message: error instanceof Error ? error.message : "The agent failed",
    });
  }
  await saveMessages(chat.id, added);
  await db
    .update(agentChatTable)
    .set({ updatedAt: new Date() })
    .where(eq(agentChatTable.id, chat.id));
  return {
    chatId: chat.id,
    title: chat.title,
    messages: [userMessage, ...added],
  };
}
