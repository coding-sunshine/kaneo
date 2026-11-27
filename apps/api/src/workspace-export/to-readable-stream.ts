/**
 * A byte stream that asks the generator for more only when the reader wants
 * it, so a slow download slows the export instead of filling memory. `done`
 * runs once, however the stream ends.
 */
export function toReadableStream(
  chunks: AsyncGenerator<Uint8Array>,
  done: () => Promise<void>,
) {
  let finished = false;
  const finish = async () => {
    if (finished) return;
    finished = true;
    await done();
  };
  return new ReadableStream<Uint8Array>({
    async pull(controller) {
      try {
        const next = await chunks.next();
        if (next.done) {
          await finish();
          controller.close();
        } else {
          controller.enqueue(next.value);
        }
      } catch (error) {
        await finish();
        controller.error(error);
      }
    },
    async cancel() {
      await chunks.return(undefined);
      await finish();
    },
  });
}
