import { assertWithinBudget } from "./budget";
import { workspaceEndpoint } from "./destination/store";
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
  purpose:
    | "assistant"
    | "loop"
    | "loop-draft"
    | "filter"
    | "summary"
    | "triage"
    | "writing";
};

// A model call made for a person: refused once a budget is spent, sent only to
// the workspace's chosen destination, and its tokens are written to
// `ai_usage` under the person and workspace.
export async function meteredCompletion(
  meter: Meter,
  messages: ChatMessage[],
  tools: unknown[],
  onText?: (delta: string) => void,
) {
  await assertWithinBudget(meter.workspaceId, meter.userId);
  const endpoint = await workspaceEndpoint(meter.workspaceId);
  let usage: CompletionUsage | undefined;
  const reply = await createCompletion(
    messages,
    tools,
    onText,
    (reported) => {
      usage = reported;
    },
    endpoint,
  );
  if (usage) await recordUsage({ ...meter, ...usage });
  return reply;
}
