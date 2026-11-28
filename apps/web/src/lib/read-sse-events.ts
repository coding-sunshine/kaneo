/** Calls `onEvent` with each `data:` line of a server-sent event stream. */
export async function readSseEvents<T>(
  body: ReadableStream,
  onEvent: (event: T) => void,
) {
  const reader = body.pipeThrough(new TextDecoderStream()).getReader();
  let buffer = "";
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += value;
    const lines = buffer.split("\n");
    buffer = lines.pop() ?? "";
    for (const line of lines) {
      if (line.startsWith("data:")) onEvent(JSON.parse(line.slice(5)) as T);
    }
  }
}
