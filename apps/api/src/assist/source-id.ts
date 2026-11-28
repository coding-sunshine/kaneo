/**
 * A source id as the model wrote it, made comparable to the ids it was
 * given: models copy the brackets, quotes or a `kind:` prefix around an id
 * they saw in the prompt, as in `[abc]` or `comment:abc`.
 */
export const sourceId = (raw: string) =>
  raw
    .trim()
    .replace(/^[[("'`#]+|[\])"'`.,;]+$/g, "")
    .replace(/^(?:task|document|comment|message|ticket)\s*:\s*/i, "")
    .trim();
