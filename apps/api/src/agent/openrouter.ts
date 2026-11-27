export type ToolCall = {
  id: string;
  type: "function";
  function: { name: string; arguments: string };
};

export type ChatMessage = {
  role: "system" | "user" | "assistant" | "tool";
  content: string | null;
  tool_calls?: ToolCall[];
  tool_call_id?: string;
};

export const DEFAULT_AGENT_MODEL = "z-ai/glm-5.3-flash";
// Hosts serve the default model with uneven quality, so the assistant stays on
// one that passed the synthetic check (scripts/assistant-host-check.ts).
export const DEFAULT_AGENT_HOST = "z-ai/fp8";

function agentProvider(model: string) {
  const host =
    process.env.AGENT_HOST ||
    (model === DEFAULT_AGENT_MODEL ? DEFAULT_AGENT_HOST : "");
  return {
    data_collection: "deny",
    ...(host ? { order: [host], allow_fallbacks: false } : {}),
  };
}

export function isAgentEnabled(): boolean {
  return Boolean(process.env.OPENROUTER_API_KEY);
}

export type CompletionUsage = {
  model: string;
  promptTokens: number;
  completionTokens: number;
  cost: number | null;
};

type StreamChunk = {
  usage?: {
    prompt_tokens?: number;
    completion_tokens?: number;
    cost?: number | null;
  };
  choices?: {
    delta?: {
      content?: string | null;
      tool_calls?: {
        index: number;
        id?: string;
        function?: { name?: string; arguments?: string };
      }[];
    };
  }[];
};

// Streams the completion (SSE) and folds the deltas into one message. Text
// deltas go to `onText` as they arrive; tool calls are only used once whole.
// The tokens the provider reports in its last chunk go to `onUsage`.
export async function createCompletion(
  messages: ChatMessage[],
  tools: unknown[],
  onText?: (delta: string) => void,
  onUsage?: (usage: CompletionUsage) => void,
): Promise<ChatMessage> {
  const model = process.env.AGENT_MODEL || DEFAULT_AGENT_MODEL;
  const response = await fetch(
    "https://openrouter.ai/api/v1/chat/completions",
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${process.env.OPENROUTER_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model,
        messages,
        ...(tools.length ? { tools } : {}),
        stream: true,
        usage: { include: true },
        provider: agentProvider(model),
      }),
      signal: AbortSignal.timeout(90_000),
    },
  );
  if (!response.ok || !response.body) {
    throw new Error(`The model request failed (HTTP ${response.status})`);
  }

  let content = "";
  let usage: StreamChunk["usage"];
  const calls: ToolCall[] = [];
  const decoder = new TextDecoder();
  let buffer = "";
  const handle = (line: string) => {
    if (!line.startsWith("data:")) return;
    const payload = line.slice(5).trim();
    if (!payload || payload === "[DONE]") return;
    let chunk: StreamChunk;
    try {
      chunk = JSON.parse(payload);
    } catch {
      return;
    }
    if (chunk.usage) usage = chunk.usage;
    const delta = chunk.choices?.[0]?.delta;
    if (delta?.content) {
      content += delta.content;
      onText?.(delta.content);
    }
    for (const part of delta?.tool_calls ?? []) {
      const call = (calls[part.index] ??= {
        id: "",
        type: "function",
        function: { name: "", arguments: "" },
      });
      if (part.id) call.id = part.id;
      call.function.name += part.function?.name ?? "";
      call.function.arguments += part.function?.arguments ?? "";
    }
  };
  for await (const bytes of response.body as unknown as AsyncIterable<Uint8Array>) {
    buffer += decoder.decode(bytes, { stream: true });
    const lines = buffer.split("\n");
    buffer = lines.pop() ?? "";
    for (const line of lines) handle(line);
  }
  handle(buffer);
  onUsage?.({
    model,
    promptTokens: usage?.prompt_tokens ?? 0,
    completionTokens: usage?.completion_tokens ?? 0,
    cost: usage?.cost ?? null,
  });

  const toolCalls = calls.filter(Boolean);
  if (!content && !toolCalls.length)
    throw new Error("The model returned no message");
  return {
    role: "assistant",
    content: content || null,
    ...(toolCalls.length ? { tool_calls: toolCalls } : {}),
  };
}
