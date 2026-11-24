import { toast } from "@/lib/toast";

/** Copies text and toasts the outcome; both messages are already translated. */
export async function copyText(text: string, done: string, failed: string) {
  try {
    await navigator.clipboard.writeText(text);
    toast.success(done);
  } catch {
    toast.error(failed);
  }
}

/**
 * Copies text that is still being produced. The clipboard write starts inside the click and
 * takes the text as a promise, so the user gesture survives the wait (Safari drops it after
 * an await). Browsers without ClipboardItem wait first and write afterwards.
 */
export async function copyTextAsync(
  text: Promise<string>,
  done: string,
  failed: string,
  generateFailed: string,
) {
  let generateError = false;
  const ready = text.catch((error) => {
    generateError = true;
    throw error;
  });
  try {
    if (typeof ClipboardItem === "undefined" || !navigator.clipboard?.write) {
      // Await first: with no clipboard the write throws before `ready` is read, leaving a rejection unhandled.
      const value = await ready;
      await navigator.clipboard.writeText(value);
    } else {
      await navigator.clipboard.write([
        new ClipboardItem({
          "text/plain": ready.then(
            (value) => new Blob([value], { type: "text/plain" }),
          ),
        }),
      ]);
    }
    toast.success(done);
  } catch {
    toast.error(generateError ? generateFailed : failed);
  }
}
