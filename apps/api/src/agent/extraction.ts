import { DEFAULT_AGENT_MODEL, isAgentEnabled } from "./openrouter";
import { recordUsage, tokensUsedToday } from "./usage";

const DEFAULT_DAILY_TOKEN_CAP = 300_000;
const MAX_OUTPUT_TOKENS = 1500;

type ExtractionRequest = {
  /** Names the call in the usage table and names the schema. */
  purpose: string;
  system: string;
  text: string;
  schema: Record<string, unknown>;
};

type Completion = {
  choices?: { message?: { content?: string | null } }[];
  usage?: {
    prompt_tokens?: number;
    completion_tokens?: number;
    cost?: number | null;
  };
};

/** The model answered, and the answer is not the JSON that was asked for. */
export class UnreadableAnswer extends Error {}

function dailyTokenCap() {
  const cap = Number(process.env.EXTRACTION_DAILY_TOKEN_CAP || Number.NaN);
  return Number.isFinite(cap) && cap >= 0 ? cap : DEFAULT_DAILY_TOKEN_CAP;
}

export function extractionModel() {
  return process.env.AGENT_MODEL || DEFAULT_AGENT_MODEL;
}

/**
 * One model call that answers in the given JSON schema, for jobs that read
 * documents. Unlike the assistant's `createCompletion` it does not stream,
 * limits the answer, writes the tokens it used to `ai_usage` and stops for
 * the day at `EXTRACTION_DAILY_TOKEN_CAP`. Returns null, without calling,
 * when no key is set or the cap is used up.
 *
 * `zdr` keeps the request on endpoints with zero data retention. An
 * OpenRouter account can still allow "safety retention" endpoints; that is
 * an account setting, not a request field.
 */
export async function extractJson<T>(
  request: ExtractionRequest,
): Promise<T | null> {
  if (!isAgentEnabled()) return null;
  if ((await tokensUsedToday()) >= dailyTokenCap()) return null;

  const model = extractionModel();
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
        stream: false,
        max_tokens: MAX_OUTPUT_TOKENS,
        reasoning: { effort: "low" },
        provider: {
          data_collection: "deny",
          zdr: true,
          require_parameters: true,
        },
        response_format: {
          type: "json_schema",
          json_schema: {
            name: request.purpose,
            strict: true,
            schema: request.schema,
          },
        },
        messages: [
          { role: "system", content: request.system },
          { role: "user", content: request.text },
        ],
      }),
      signal: AbortSignal.timeout(90_000),
    },
  );
  if (!response.ok) {
    throw new Error(`The extraction request failed (HTTP ${response.status})`);
  }
  const completion = (await response.json()) as Completion;
  await recordUsage({
    purpose: request.purpose,
    model,
    promptTokens: completion.usage?.prompt_tokens ?? 0,
    completionTokens: completion.usage?.completion_tokens ?? 0,
    cost: completion.usage?.cost ?? null,
  });
  const content = completion.choices?.[0]?.message?.content;
  if (!content) throw new UnreadableAnswer("The extraction answer was empty");
  try {
    return JSON.parse(content) as T;
  } catch {
    throw new UnreadableAnswer("The extraction answer was not JSON");
  }
}
