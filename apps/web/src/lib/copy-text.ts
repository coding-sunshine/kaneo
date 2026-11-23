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
