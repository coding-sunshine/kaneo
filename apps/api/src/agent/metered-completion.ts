import { assertWithinBudget } from "./budget";
import {
  type ChatMessage,
  type CompletionUsage,
  createCompletion,
} from "./openrouter";
import { recordUsage } from "./usage";

/** Who a model call is for, and the feature it is counted under. */
export type Meter = {
  workspaceId: string;
  userId: string;
  purpose: "assistant" | "loop" | "loop-draft";
};

// A model call made for a person: refused once a budget is spent, and its
// tokens are written to `ai_usage` under the person and workspace.
export async function meteredCompletion(
  meter: Meter,
  messages: ChatMessage[],
  tools: unknown[],
  onText?: (delta: string) => void,
) {
  await assertWithinBudget(meter.workspaceId, meter.userId);
  let usage: CompletionUsage | undefined;
  const reply = await createCompletion(messages, tools, onText, (reported) => {
    usage = reported;
  });
  if (usage) await recordUsage({ ...meter, ...usage });
  return reply;
}
