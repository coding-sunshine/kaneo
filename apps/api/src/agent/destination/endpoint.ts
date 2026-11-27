import { HTTPException } from "hono/http-exception";
import { type ModelEndpoint, openRouterEndpoint } from "../openrouter";

export const AI_PROVIDERS = ["openrouter", "self-hosted"] as const;
export type AiProvider = (typeof AI_PROVIDERS)[number];

/** Which provider receives a workspace's text; `model` names a self-hosted model. */
export type AiDestination = { provider: AiProvider; model: string | null };

// The server owner sets the self-hosted URL; an admin only picks the model,
// so nobody can point the workspace's text at an address of their choosing.
export const selfHostedUrl = () => process.env.AI_SELF_HOSTED_URL?.trim() || "";
/** The self-hosted model used until an admin names one. */
export const selfHostedDefaultModel = () =>
  process.env.AI_SELF_HOSTED_MODEL?.trim() || "";
export const openRouterConfigured = () =>
  Boolean(process.env.OPENROUTER_API_KEY);

export const defaultDestination = (): AiDestination => ({
  provider:
    openRouterConfigured() || !selfHostedUrl() ? "openrouter" : "self-hosted",
  model: null,
});

const unavailable = (message: string) => new HTTPException(503, { message });

/**
 * The endpoint the destination's calls go to. A destination the server cannot
 * serve is refused, never sent to the other provider.
 */
export function endpointFor(destination: AiDestination): ModelEndpoint {
  if (destination.provider === "openrouter") {
    if (!openRouterConfigured())
      throw unavailable(
        "AI is off for this workspace: OpenRouter is not configured on this server.",
      );
    return openRouterEndpoint();
  }
  const base = selfHostedUrl();
  const model = destination.model || selfHostedDefaultModel();
  if (!base || !model)
    throw unavailable(
      "AI is off for this workspace: the self-hosted model is not configured on this server.",
    );
  const key = process.env.AI_SELF_HOSTED_API_KEY;
  return {
    provider: "self-hosted",
    url: `${base.replace(/\/+$/, "")}/chat/completions`,
    headers: key ? { Authorization: `Bearer ${key}` } : {},
    model,
  };
}
