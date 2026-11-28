import {
  registerTools,
  type ToolClient,
  type ToolRegistrar,
} from "@kaneo/mcp/tools";
import { z } from "zod";
import { cutCurrent } from "./cut-current";
import {
  applyChangeTask,
  CHANGE_TASK_DESCRIPTION,
  changeTaskSchema,
} from "./proposals/change-task-tool";
import {
  LIST_WORK_PROJECTS_DESCRIPTION,
  listWorkProjects,
  listWorkProjectsSchema,
  PROJECT_UPDATE_DESCRIPTION,
  PROJECT_UPDATE_TOOL,
  postProjectUpdate,
  projectUpdateSchema,
} from "./proposals/project-update-tool";
import {
  DIGEST_DESCRIPTION,
  DIGEST_TOOL,
  digestSchema,
  POST_DIGEST_DESCRIPTION,
  POST_DIGEST_TOOL,
  postDigest,
  postDigestSchema,
  refuseDigestRun,
} from "./digest/digest-tool";
import {
  DELEGATE_DESCRIPTION,
  DELEGATE_TOOL,
  delegateTaskSchema,
  startDelegation,
} from "./delegation/delegate-tool";
import {
  applyThreadTicket,
  THREAD_TICKET_DESCRIPTION,
  THREAD_TICKET_TOOL,
  threadTicketSchema,
} from "./thread-ticket/thread-ticket-tool";
import {
  applyTriage,
  TRIAGE_DESCRIPTION,
  TRIAGE_TOOL,
  triageTaskSchema,
} from "./triage/triage-tool";

const MAX_RESULT_CHARS = 20_000;

// Reads: every list_/get_ tool plus search and whoami. Writes are an explicit
// allowlist; everything else (deletes, labels, time entries...) stays out.
const READ_TOOLS = /^(list_|get_)|^(search|whoami)$/;
export const WRITE_TOOLS = [
  "create_task",
  "update_task",
  "update_task_status",
  "update_task_assignee",
  "create_task_comment",
  PROJECT_UPDATE_TOOL,
  DIGEST_TOOL,
] as const;
// Writes that are only ever proposed: they run when a person accepts them.
export const ALWAYS_PROPOSED: readonly string[] = [
  PROJECT_UPDATE_TOOL,
  DIGEST_TOOL,
];
// The writes offered when none are named: a project update is opt-in.
const DEFAULT_WRITES = WRITE_TOOLS.filter(
  (name) => !ALWAYS_PROPOSED.includes(name),
);
// Writes only a feature proposes (never the model in a chat or loop).
const FEATURE_WRITES: readonly string[] = [
  TRIAGE_TOOL,
  DELEGATE_TOOL,
  POST_DIGEST_TOOL,
  THREAD_TICKET_TOOL,
];
// Every write a proposal can hold: change_task sets priority and labels.
export const CHAT_WRITE_TOOLS = [
  ...WRITE_TOOLS,
  "change_task",
  TRIAGE_TOOL,
  DELEGATE_TOOL,
  POST_DIGEST_TOOL,
  THREAD_TICKET_TOOL,
] as const;
// The writes a chat offers: project updates and digests are drafted by loops.
export const CHAT_OFFERED_WRITES = CHAT_WRITE_TOOLS.filter(
  (name) => !ALWAYS_PROPOSED.includes(name) && !FEATURE_WRITES.includes(name),
);

export type ProposeRequest = {
  tool: string;
  args: Record<string, unknown>;
  reason: string;
  sources: string[];
};
/** Records a write as a proposal and returns what the model is told. */
export type Propose = (request: ProposeRequest) => Promise<string>;

export type OpenRouterTool = {
  type: "function";
  function: {
    name: string;
    description: string;
    parameters: Record<string, unknown>;
  };
};

type Handler = Parameters<ToolRegistrar["registerTool"]>[2];

const isWriteTool = (name: string) =>
  (CHAT_WRITE_TOOLS as readonly string[]).includes(name);

const error = (message: string) => JSON.stringify({ error: message });

// Every write in a chat says why, and may name the sources it rests on.
function withReason(parameters: Record<string, unknown>) {
  const properties = (parameters.properties ?? {}) as Record<string, unknown>;
  const required = (parameters.required ?? []) as string[];
  return {
    ...parameters,
    properties: {
      ...properties,
      reason: {
        type: "string",
        description:
          "One sentence on why, shown to the person who accepts or declines the change.",
      },
      sources: {
        type: "array",
        items: { type: "string" },
        description:
          "What the change rests on, as task:<id>, document:<id> or comment:<id>.",
      },
    },
    required: [...required, "reason"],
  };
}

// `writes` narrows the write tools on offer (default: every write but the
// project update). A tool outside it is neither shown to the model nor
// callable. With `propose`, a write is never run: it becomes a proposal a
// person accepts later; `proposeOnly` limits that to the named writes, and the
// others run. A project update is always proposed, never run by the agent.
export function buildAgentTools(
  client: ToolClient,
  writes: readonly string[] = DEFAULT_WRITES,
  propose?: Propose,
  proposeOnly?: readonly string[],
) {
  const allowed = new Set(writes);
  const proposed = (name: string) =>
    isWriteTool(name) &&
    (ALWAYS_PROPOSED.includes(name) ||
      !proposeOnly ||
      proposeOnly.includes(name));
  const definitions: OpenRouterTool[] = [];
  const handlers = new Map<string, Handler>();
  const schemas = new Map<string, z.ZodObject>();
  const collector: ToolRegistrar = {
    registerTool(name, config, callback) {
      const isWrite = isWriteTool(name);
      if (isWrite ? !allowed.has(name) : !READ_TOOLS.test(name)) return;
      const { $schema: _omit, ...parameters } = z.toJSONSchema(
        config.inputSchema,
      ) as Record<string, unknown>;
      definitions.push({
        type: "function",
        function: {
          name,
          description: config.description,
          parameters:
            propose && proposed(name) ? withReason(parameters) : parameters,
        },
      });
      handlers.set(name, callback);
      schemas.set(name, config.inputSchema);
    },
  };
  registerTools(collector, { client });
  // Tools of the agent's own, beside the MCP ones.
  const local = <S extends z.ZodObject>(
    name: string,
    description: string,
    inputSchema: S,
    apply: (args: z.output<S>) => Promise<unknown>,
  ) =>
    collector.registerTool(name, { description, inputSchema }, async (args) => {
      const parsed = inputSchema.safeParse(args);
      const text = (data: unknown, isError = false) => ({
        content: [{ type: "text" as const, text: JSON.stringify(data) }],
        isError,
      });
      if (!parsed.success)
        return text({ error: z.prettifyError(parsed.error) }, true);
      return apply(parsed.data).then(
        (data) => text(data),
        (e: unknown) =>
          text({ error: e instanceof Error ? e.message : String(e) }, true),
      );
    });
  local("change_task", CHANGE_TASK_DESCRIPTION, changeTaskSchema, (args) =>
    applyChangeTask(client, args),
  );
  local(TRIAGE_TOOL, TRIAGE_DESCRIPTION, triageTaskSchema, (args) =>
    applyTriage(client, args),
  );
  local(DELEGATE_TOOL, DELEGATE_DESCRIPTION, delegateTaskSchema, (args) =>
    startDelegation(client, args),
  );
  local(
    "list_work_projects",
    LIST_WORK_PROJECTS_DESCRIPTION,
    listWorkProjectsSchema,
    (args) => listWorkProjects(client, args),
  );
  local(
    THREAD_TICKET_TOOL,
    THREAD_TICKET_DESCRIPTION,
    threadTicketSchema,
    (args) => applyThreadTicket(client, args),
  );
  local(DIGEST_TOOL, DIGEST_DESCRIPTION, digestSchema, refuseDigestRun);
  local(POST_DIGEST_TOOL, POST_DIGEST_DESCRIPTION, postDigestSchema, (args) =>
    postDigest(client, args),
  );
  local(
    PROJECT_UPDATE_TOOL,
    PROJECT_UPDATE_DESCRIPTION,
    projectUpdateSchema,
    (args) => postProjectUpdate(client, args),
  );

  /** Runs a tool for real; `isError` is true when it failed. */
  async function run(name: string, args: unknown) {
    const handler = handlers.get(name);
    if (!handler) return { text: error(`Unknown tool ${name}`), isError: true };
    const result = await handler(args);
    const text = result.content
      .map((part) => (part.type === "text" ? part.text : ""))
      .join("");
    const isError = Boolean(result.isError);
    if (text.length <= MAX_RESULT_CHARS) return { text, isError };
    // An approved text is cut so the answer stays whole and says where to
    // read on.
    const from = (args as { textFrom?: unknown } | null)?.textFrom;
    const cut =
      name === "get_current"
        ? cutCurrent(
            text,
            MAX_RESULT_CHARS,
            typeof from === "number" ? from : 0,
          )
        : null;
    return {
      text:
        cut ??
        `${text.slice(0, MAX_RESULT_CHARS)}\n[cut: this result has ${text.length} characters and only the first ${MAX_RESULT_CHARS} are shown]`,
      isError,
    };
  }

  async function proposeWrite(name: string, args: unknown) {
    const { reason, sources, ...rest } = (args ?? {}) as Record<
      string,
      unknown
    >;
    if (typeof reason !== "string" || !reason.trim()) {
      return error("A change needs a reason: say why in one sentence.");
    }
    const parsed = schemas.get(name)?.safeParse(rest);
    if (!parsed?.success) {
      return error(
        parsed ? z.prettifyError(parsed.error) : `Unknown tool ${name}`,
      );
    }
    return (propose as Propose)({
      tool: name,
      args: parsed.data as Record<string, unknown>,
      reason: reason.trim(),
      sources: Array.isArray(sources) ? sources.map(String) : [],
    });
  }

  async function call(name: string, rawArguments: string): Promise<string> {
    if (!handlers.has(name)) return error(`Unknown tool ${name}`);
    let args: unknown;
    try {
      args = rawArguments ? JSON.parse(rawArguments) : {};
    } catch {
      return error("Arguments are not valid JSON");
    }
    if (propose && proposed(name)) return proposeWrite(name, args);
    if (ALWAYS_PROPOSED.includes(name))
      return error("This write needs a person to accept it.");
    return (await run(name, args)).text;
  }

  return { definitions, call, run };
}
