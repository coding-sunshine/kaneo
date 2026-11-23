import { copyText } from "@/lib/copy-text";
import { toast } from "@/lib/toast";

/** Copies rich HTML with a plain-text twin; plain text alone where the browser cannot. */
export async function copyHtml(
  html: string,
  text: string,
  done: string,
  failed: string,
) {
  if (typeof ClipboardItem === "undefined" || !navigator.clipboard?.write) {
    return copyText(text, done, failed);
  }
  try {
    await navigator.clipboard.write([
      new ClipboardItem({
        "text/html": new Blob([html], { type: "text/html" }),
        "text/plain": new Blob([text], { type: "text/plain" }),
      }),
    ]);
    toast.success(done);
  } catch {
    toast.error(failed);
  }
}
