const DEFAULT_URL = "https://api.openai.com/v1/embeddings";
const DEFAULT_MODEL = "text-embedding-3-small";

/** Semantic search is on when the server has an embedding key. */
export const isSemanticSearchEnabled = () =>
  Boolean(process.env.EMBEDDING_API_KEY?.trim());

const unit = (vector: number[]) => {
  const length = Math.hypot(...vector);
  return length ? vector.map((value) => value / length) : vector;
};

/**
 * Embeds texts with the OpenAI-compatible endpoint in EMBEDDING_API_URL, as
 * unit vectors so a dot product is their cosine similarity.
 */
export async function embed(texts: string[]): Promise<number[][]> {
  if (texts.length === 0) return [];
  const response = await fetch(process.env.EMBEDDING_API_URL || DEFAULT_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${process.env.EMBEDDING_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: process.env.EMBEDDING_MODEL || DEFAULT_MODEL,
      input: texts,
    }),
    signal: AbortSignal.timeout(60_000),
  });
  if (!response.ok)
    throw new Error(`The embedding request failed (HTTP ${response.status})`);
  const body = (await response.json()) as {
    data?: { index: number; embedding: number[] }[];
  };
  const vectors = [...(body.data ?? [])].sort((a, b) => a.index - b.index);
  if (vectors.length !== texts.length)
    throw new Error("The embedding service returned the wrong count");
  return vectors.map((row) => unit(row.embedding));
}
