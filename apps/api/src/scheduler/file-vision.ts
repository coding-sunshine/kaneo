import { createHash } from "node:crypto";
import {
  extractJson,
  readsFiles,
  RefusedRequest,
  UnreadableAnswer,
} from "../agent/extraction";
import { ReadLater } from "./read-later";
import type { See } from "./task-file-text";

const SYSTEM = `You write out the words in the attached file, a scan, a photo or a picture, exactly as they are written: every word, number and date, in reading order, a line for each line or table row. Leave nothing out and add nothing: no summary, no description of the picture, no comment. When the file has no words, answer with an empty text. When the words do not fit in one answer, stop at the end of a line and set "more" to true; you will be asked to go on.`;
const SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["text", "more"],
  properties: { text: { type: "string" }, more: { type: "boolean" } },
};
// One answer is at most this long. A longer text comes in several answers,
// each sent with the file again.
const MAX_ANSWER_TOKENS = 16_000;
// The words of the files written out last, by the hash of their bytes, so a
// file read again after a stop is not paid for twice, even every picture of
// the largest archive. In memory only, and text only.
const written = new Map<string, string>();
const KEEP = 5000;

type Words = { text?: string; more?: boolean };

/**
 * The model writes out the words of a PDF or a picture, whole, in as many
 * answers as it needs. Uses the caps of the job that calls it, with its
 * `reserve`, and one of the run's `questions` for each answer. Throws
 * `ReadLater` when a cap or the run's questions are used up or a request
 * failed and can be sent again, and another error when the file cannot be
 * written out: a request refused for what it holds, or an answer that is not
 * the JSON asked for.
 */
export const seeWith = (
  reserve: number,
  run: { parts: number },
  workspaceId: string,
): See => {
  let reads: Promise<boolean> | undefined;
  return async (file) => {
    // A self-hosted model gets no files: the file waits for a model that
    // reads it, and is not recorded as read or unreadable.
    reads ??= readsFiles(workspaceId);
    if (!(await reads)) throw new ReadLater(false, true);
    const hash = createHash("sha256").update(file.bytes).digest("hex");
    const known = written.get(hash);
    if (known !== undefined) return known;
    let text = "";
    for (;;) {
      const ask = text
        ? `Go on writing out the words of the attached file ${file.filename}, after these words, which end what you wrote so far:\n${text.slice(-300)}`
        : `Write out the words of the attached file ${file.filename}.`;
      if (run.parts <= 0) throw new ReadLater(false);
      let answer: Words | null;
      try {
        answer = await extractJson<Words>({
          purpose: "task-file-words",
          workspaceId,
          system: SYSTEM,
          text: ask,
          schema: SCHEMA,
          reserve,
          file,
          maxTokens: MAX_ANSWER_TOKENS,
        });
      } catch (error) {
        if (error instanceof UnreadableAnswer) throw error;
        if (error instanceof RefusedRequest) throw error;
        console.error(`Writing out ${file.filename} failed`, error);
        throw new ReadLater(true);
      }
      if (!answer) throw new ReadLater(false);
      run.parts -= 1;
      const added = (answer.text ?? "").trim();
      // An answer that adds nothing new ends it: a model that repeats itself
      // is not asked forever.
      if (!added || text.endsWith(added)) break;
      text = text ? `${text}\n${added}` : added;
      if (!answer.more) break;
    }
    if (written.size >= KEEP) {
      const oldest = written.keys().next().value;
      if (oldest !== undefined) written.delete(oldest);
    }
    written.set(hash, text);
    return text;
  };
};
