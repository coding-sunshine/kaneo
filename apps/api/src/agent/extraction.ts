import { DEFAULT_AGENT_MODEL, isAgentEnabled } from "./openrouter";
import { recordUsage, tokensUsedToday, withinMonthlyCap } from "./usage";

const DEFAULT_DAILY_TOKEN_CAP = 300_000;
const MAX_OUTPUT_TOKENS = 1500;

type ExtractionRequest = {
  /** Names the call in the usage table and names the schema. */
  purpose: string;
  system: string;
  text: string;
  schema: Record<string, unknown>;
  /**
   * The share of both caps this call leaves to the others, from 0 to 1. A
   * job that reads a lot gives way with it, so reading documents never stops.
   */
  reserve?: number;
  /** A PDF or a picture sent with the text, for the model to read itself. */
  file?: { bytes: Uint8Array; mimeType: string; filename: string };
  /** The longest answer, in tokens, when it may be longer than the default. */
  maxTokens?: number;
};

type Completion = {
  choices?: { message?: { content?: string | null } }[];
  usage?: {
    prompt_tokens?: number;
    completion_tokens?: number;
    cost?: number | null;
  };
};

const base64 = (bytes: Uint8Array) =>
  Buffer.from(bytes.buffer, bytes.byteOffset, bytes.length).toString("base64");

// A PDF goes as a file and a picture as an image. A PDF is read by the model
// itself ("native"), so it is not sent on to an OCR service.
const withFile = ({ file, text }: ExtractionRequest) =>
  file
    ? {
        content: [
          { type: "text", text },
          file.mimeType === "application/pdf"
            ? {
                type: "file",
                file: {
                  filename: file.filename,
                  file_data: `data:application/pdf;base64,${base64(file.bytes)}`,
                },
              }
            : {
                type: "image_url",
                image_url: {
                  url: `data:${file.mimeType};base64,${base64(file.bytes)}`,
                },
              },
        ],
        plugins:
          file.mimeType === "application/pdf"
            ? [{ id: "file-parser", pdf: { engine: "native" } }]
            : undefined,
      }
    : { content: text, plugins: undefined };

/**
 * The request was refused for what it holds (HTTP 4xx other than a timeout or
 * a rate limit): sending it again gets the same answer.
 */
export class RefusedRequest extends Error {}

/** The model answered, and the answer is not the JSON that was asked for. */
export class UnreadableAnswer extends Error {}

function dailyTokenCap() {
  const cap = Number(process.env.EXTRACTION_DAILY_TOKEN_CAP || Number.NaN);
  return Number.isFinite(cap) && cap >= 0 ? cap : DEFAULT_DAILY_TOKEN_CAP;
}

/** Jobs that read documents can run on another model than the assistant. */
export function extractionModel() {
  return (
    process.env.EXTRACTION_MODEL ||
    process.env.AGENT_MODEL ||
    DEFAULT_AGENT_MODEL
  );
}

/**
 * One model call that answers in the given JSON schema, for jobs that read
 * documents. Unlike the assistant's `createCompletion` it does not stream,
 * limits the answer, writes the tokens it used to `ai_usage` and stops for
 * the day at `EXTRACTION_DAILY_TOKEN_CAP` and for the calendar month at
 * `AI_MONTHLY_USD_CAP` dollars. Returns null, without calling, when no key is
 * set or a cap is used up.
 *
 * `zdr` keeps the request on endpoints with zero data retention. An
 * OpenRouter account can still allow "safety retention" endpoints; that is
 * an account setting, not a request field.
 */
export async function extractJson<T>(
  request: ExtractionRequest,
): Promise<T | null> {
  if (!isAgentEnabled()) return null;
  const share = 1 - (request.reserve ?? 0);
  if ((await tokensUsedToday()) >= dailyTokenCap() * share) return null;
  if (!(await withinMonthlyCap(share))) return null;

  const model = extractionModel();
  const { content: user, plugins } = withFile(request);
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
        max_tokens: request.maxTokens ?? MAX_OUTPUT_TOKENS,
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
          { role: "user", content: user },
        ],
        plugins,
      }),
      // Writing out a long file takes longer than answering about a text.
      signal: AbortSignal.timeout(request.file ? 300_000 : 90_000),
    },
  );
  if (!response.ok) {
    const message = `The extraction request failed (HTTP ${response.status})`;
    const { status } = response;
    if (status >= 400 && status < 500 && status !== 408 && status !== 429) {
      throw new RefusedRequest(message);
    }
    throw new Error(message);
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
