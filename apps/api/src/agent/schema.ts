import { responseTimestamp, z } from "../openapi";
import { citationSchema } from "./citation-schema";
import { proposalSchema } from "./proposals/proposal-schema";

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
    proposals: z.array(proposalSchema).openapi({
      description: "The writes the agent proposed in this chat.",
    }),
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
