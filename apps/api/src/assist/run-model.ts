import { assertWithinBudget } from "../agent/budget";
import { workspaceEndpoint } from "../agent/destination/store";
import {
  type ChatMessage,
  type CompletionUsage,
  createCompletion,
} from "../agent/openrouter";
import { recordUsage } from "../agent/usage";

/**
 * One model call made for a person, like `meteredCompletion`, that also
 * hands back the tokens it used, for features that show or cap them.
 */
export async function runModel(
  meter: { workspaceId: string; userId: string; purpose: string },
  messages: ChatMessage[],
) {
  await assertWithinBudget(meter.workspaceId, meter.userId);
  const endpoint = await workspaceEndpoint(meter.workspaceId);
  let usage: CompletionUsage | undefined;
  const reply = await createCompletion(
    messages,
    [],
    undefined,
    (reported) => {
      usage = reported;
    },
    endpoint,
  );
  if (usage) await recordUsage({ ...meter, ...usage });
  return {
    content: reply.content ?? "",
    promptTokens: usage?.promptTokens ?? 0,
    completionTokens: usage?.completionTokens ?? 0,
  };
}
