import { assertWithinBudget } from "../agent/budget";
import { workspaceEndpoint } from "../agent/destination/store";
import {
  type ChatMessage,
  type CompletionUsage,
  createCompletion,
} from "../agent/openrouter";
import { recordUsage } from "../agent/usage";
import { estimateTokens } from "./estimate-tokens";

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
  const content = reply.content ?? "";
  // A provider that reports no usage still spent tokens: estimate them.
  const spent = usage ?? {
    model: endpoint.model,
    promptTokens: estimateTokens(
      messages.map((message) => message.content ?? "").join("\n"),
    ),
    completionTokens: estimateTokens(content),
    cost: null,
  };
  await recordUsage({ ...meter, ...spent });
  return {
    content,
    promptTokens: spent.promptTokens,
    completionTokens: spent.completionTokens,
  };
}
