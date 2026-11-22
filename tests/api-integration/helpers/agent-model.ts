import type { ChatMessage } from "../../../apps/api/src/agent/openrouter";

// Scripted stand-in for the OpenRouter client: tests queue the replies the
// "model" gives, and read back what it was sent.
export const model = {
  queue: [] as ChatMessage[],
  seen: [] as ChatMessage[][],
};

export const reply = (content: string): ChatMessage => ({
  role: "assistant",
  content,
});

export const callTool = (name: string, args: object): ChatMessage => ({
  role: "assistant",
  content: null,
  tool_calls: [
    {
      id: `call-${name}`,
      type: "function",
      function: { name, arguments: JSON.stringify(args) },
    },
  ],
});
