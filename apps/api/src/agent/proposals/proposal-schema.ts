import { nullableResponseTimestamp, responseTimestamp, z } from "../../openapi";
import { citationSchema } from "../citation-schema";

export const proposalParam = z.object({
  workspaceId: z.string(),
  proposalId: z.string(),
});

export const taskProposalsParam = z.object({
  workspaceId: z.string(),
  taskId: z.string(),
});

export const acceptQuery = z.object({
  fields: z.string().max(200).optional().openapi({
    description:
      "On a selectable proposal: the fields to apply, comma-separated (such as `labels,priority`). Omitted applies every field.",
  }),
  customFields: z.string().max(20_000).optional().openapi({
    description:
      'On a ticket from a chat thread: a JSON array of `{"fieldId", "value"}` for the team\'s required fields listed in `needsFields`.',
  }),
});

/** The values `customFields` holds, once read from its JSON. */
export const ticketFieldValues = z
  .array(
    z.object({ fieldId: z.string().min(1), value: z.string().max(10_000) }),
  )
  .max(50);

const statusSchema = z.enum(["pending", "accepted", "declined", "failed"]);

const fieldChangeSchema = z
  .object({
    field: z.string().openapi({
      description:
        "priority, labels, status, title, description, assignee, team, startDate, dueDate or comment.",
    }),
    from: z.string().nullable(),
    to: z.string().nullable(),
    reason: z.string().optional().openapi({
      description: "Why this one field is suggested, when the card says so.",
    }),
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
    selectable: z.boolean().openapi({
      description:
        "True when the person may keep some fields and drop others: accept with `fields`.",
    }),
    sources: z.array(citationSchema),
    decidedAt: nullableResponseTimestamp,
    result: z.string().nullable().openapi({
      description: "On a failed proposal: what the API answered.",
    }),
    needsFields: z
      .object({ projectId: z.string(), fieldIds: z.array(z.string()) })
      .nullable()
      .openapi({
        description:
          "On a pending ticket from a chat thread: the team's required fields without a default. Accept with a value for each in `customFields`.",
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
