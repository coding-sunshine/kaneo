import { nullableResponseTimestamp, responseTimestamp, z } from "../../openapi";
import { citationSchema } from "../citation-schema";

export const proposalParam = z.object({
  workspaceId: z.string(),
  proposalId: z.string(),
});

const statusSchema = z.enum(["pending", "accepted", "declined", "failed"]);

const fieldChangeSchema = z
  .object({
    field: z.string().openapi({
      description:
        "priority, labels, status, title, description, assignee, team, startDate, dueDate or comment.",
    }),
    from: z.string().nullable(),
    to: z.string().nullable(),
  })
  .openapi("AgentFieldChange");

export const proposalSchema = z
  .object({
    id: z.string(),
    toolCallId: z.string().openapi({
      description: "The tool call in the chat transcript that proposed it.",
    }),
    tool: z.string(),
    taskId: z.string().nullable(),
    status: statusSchema,
    diff: z.array(fieldChangeSchema),
    reason: z.string(),
    sources: z.array(citationSchema),
    decidedAt: nullableResponseTimestamp,
    result: z.string().nullable().openapi({
      description: "On a failed proposal: what the API answered.",
    }),
  })
  .openapi("AgentProposal", {
    description:
      "A write the agent proposed. Nothing changes until the person who asked accepts it.",
  });

const personSchema = z.object({ id: z.string(), name: z.string() }).nullable();

export const auditRowSchema = z
  .object({
    id: z.string(),
    kind: z.enum(["write", "setting"]).openapi({
      description:
        "`write` is an agent write someone accepted; `setting` is an admin's change of the AI data destination (tool `set_ai_destination`).",
    }),
    tool: z.string(),
    taskId: z.string().nullable(),
    status: statusSchema,
    prompt: z.string().openapi({
      description: "The person's message the proposal came from.",
    }),
    toolCalls: z
      .array(
        z.object({ id: z.string(), name: z.string(), arguments: z.string() }),
      )
      .openapi({ description: "The tool call that proposed the write." }),
    diff: z.array(fieldChangeSchema),
    reason: z.string(),
    sources: z.array(citationSchema),
    requestedBy: personSchema,
    acceptedBy: personSchema,
    result: z.string().nullable().openapi({
      description: "What the API answered when the write ran.",
    }),
    createdAt: responseTimestamp,
    decidedAt: nullableResponseTimestamp,
  })
  .openapi("AgentAuditRow");

export const auditListSchema = z.array(auditRowSchema);
