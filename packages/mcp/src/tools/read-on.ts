type WithText = { topics?: { current?: { text?: unknown } | null }[] };

/** A get_current answer whose approved texts start at character `from`. */
export function readOn<T>(data: T, from: number): T {
  const topics = (data as WithText | null)?.topics;
  if (!Array.isArray(topics)) return data;
  for (const topic of topics) {
    const current = topic?.current;
    if (current && typeof current.text === "string") {
      current.text = current.text.slice(from);
    }
  }
  return data;
}
