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

export function isAgentEnabled(): boolean {
  return Boolean(process.env.OPENROUTER_API_KEY);
}

export async function createCompletion(
  messages: ChatMessage[],
  tools: unknown[],
): Promise<ChatMessage> {
  const response = await fetch(
    "https://openrouter.ai/api/v1/chat/completions",
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${process.env.OPENROUTER_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: process.env.AGENT_MODEL || DEFAULT_AGENT_MODEL,
        messages,
        tools,
        provider: { data_collection: "deny" },
      }),
      signal: AbortSignal.timeout(90_000),
    },
  );
  if (!response.ok) {
    throw new Error(`The model request failed (HTTP ${response.status})`);
  }
  const data = (await response.json()) as {
    choices?: { message?: ChatMessage }[];
  };
  const message = data.choices?.[0]?.message;
  if (!message) throw new Error("The model returned no message");
  return {
    role: "assistant",
    content: message.content ?? null,
    ...(message.tool_calls?.length ? { tool_calls: message.tool_calls } : {}),
  };
}
