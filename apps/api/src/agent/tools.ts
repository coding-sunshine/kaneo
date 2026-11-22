import {
  registerTools,
  type ToolClient,
  type ToolRegistrar,
} from "@kaneo/mcp/tools";
import { z } from "zod";

const MAX_RESULT_CHARS = 20_000;

// Reads: every list_/get_ tool plus search and whoami. Writes are an explicit
// allowlist; everything else (deletes, labels, time entries...) stays out.
const READ_TOOLS = /^(list_|get_)|^(search|whoami)$/;
const WRITE_TOOLS = new Set([
  "create_task",
  "update_task",
  "update_task_status",
  "update_task_assignee",
  "create_task_comment",
]);

export type OpenRouterTool = {
  type: "function";
  function: {
    name: string;
    description: string;
    parameters: Record<string, unknown>;
  };
};

type Handler = Parameters<ToolRegistrar["registerTool"]>[2];

export function buildAgentTools(client: ToolClient) {
  const definitions: OpenRouterTool[] = [];
  const handlers = new Map<string, Handler>();
  const collector: ToolRegistrar = {
    registerTool(name, config, callback) {
      if (!READ_TOOLS.test(name) && !WRITE_TOOLS.has(name)) return;
      const { $schema: _omit, ...parameters } = z.toJSONSchema(
        config.inputSchema,
      ) as Record<string, unknown>;
      definitions.push({
        type: "function",
        function: { name, description: config.description, parameters },
      });
      handlers.set(name, callback);
    },
  };
  registerTools(collector, { client });

  async function call(name: string, rawArguments: string): Promise<string> {
    const handler = handlers.get(name);
    if (!handler) return JSON.stringify({ error: `Unknown tool ${name}` });
    let args: unknown;
    try {
      args = rawArguments ? JSON.parse(rawArguments) : {};
    } catch {
      return JSON.stringify({ error: "Arguments are not valid JSON" });
    }
    const result = await handler(args);
    const text = result.content
      .map((part) => (part.type === "text" ? part.text : ""))
      .join("");
    return text.length > MAX_RESULT_CHARS
      ? `${text.slice(0, MAX_RESULT_CHARS)}\n[truncated]`
      : text;
  }

  return { definitions, call };
}
