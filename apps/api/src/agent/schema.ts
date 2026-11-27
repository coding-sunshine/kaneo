import { responseTimestamp, z } from "../openapi";
import { SOURCE_KINDS } from "./sources";

export const workspaceParam = z.object({ workspaceId: z.string() });
export const chatParam = z.object({
  workspaceId: z.string(),
  chatId: z.string(),
});

export const sendMessageBody = z.object({
  chatId: z.string().optional().openapi({
    description: "Existing chat to continue. Omit to start a new chat.",
  }),
  message: z.string().trim().min(1).max(10_000),
});

const citationSchema = z
  .union([
    z.object({
      kind: z.enum(SOURCE_KINDS),
      restricted: z.literal(false),
      id: z.string(),
      title: z.string(),
      taskId: z.string().optional().openapi({
        description: "The issue a task or a comment is on.",
      }),
      projectId: z.string().optional(),
      ticket: z.string().optional(),
    }),
    z.object({
      kind: z.enum(SOURCE_KINDS),
      restricted: z.literal(true),
    }),
  ])
  .openapi("AgentCitation", {
    description:
      "A source an answer rests on. One the reader cannot open, or that is gone, is only `restricted`, with no title or id.",
  });

export const chatMessageSchema = z
  .object({
    role: z.enum(["system", "user", "assistant", "tool"]),
    content: z.string().nullable(),
    tool_calls: z
      .array(
        z.object({
          id: z.string(),
          type: z.literal("function"),
          function: z.object({ name: z.string(), arguments: z.string() }),
        }),
      )
      .optional(),
    tool_call_id: z.string().optional(),
    citations: z.array(citationSchema).optional().openapi({
      description:
        "On an answer: the tasks, documents and comments it rests on, checked against the reader's access when the chat is read.",
    }),
    unsourced: z.boolean().optional().openapi({
      description: "On an answer: true when it names no source.",
    }),
  })
  .openapi("AgentMessage");

export const chatSummarySchema = z
  .object({
    id: z.string(),
    title: z.string(),
    updatedAt: responseTimestamp,
  })
  .openapi("AgentChatSummary");

export const chatSummaryListSchema = z.array(chatSummarySchema);

export const chatDetailSchema = z
  .object({
    id: z.string(),
    title: z.string(),
    messages: z.array(chatMessageSchema),
  })
  .openapi("AgentChat");

export const sentMessageSchema = z
  .object({
    chatId: z.string(),
    title: z.string(),
    messages: z.array(chatMessageSchema).openapi({
      description:
        "The user message plus everything the agent added: tool calls, tool results and the final reply.",
    }),
  })
  .openapi("AgentReply");

export const deletedChatSchema = z.object({ id: z.string() });
