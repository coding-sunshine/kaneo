import { Cron } from "croner";
import { indexSemanticChunks } from "../semantic-search/index-chunks";
import { isSpeechToTextEnabled } from "../meeting-notes/transcribe";
import { isSemanticSearchEnabled } from "./embeddings";

type Wrap = (name: string, fn: () => Promise<unknown>) => () => Promise<void>;

/** The scheduled jobs of this lane's AI features, each wrapped for monitoring. */
export function assistJobs(wrap: Wrap): Cron[] {
  const jobs: Cron[] = [];
  if (isSemanticSearchEnabled())
    jobs.push(
      new Cron(
        "* * * * *",
        { protect: true },
        wrap("semantic-index", indexSemanticChunks),
      ),
    );
  else
    console.log(
      "ℹ️ Semantic search is off: set EMBEDDING_API_KEY (and optionally EMBEDDING_API_URL, EMBEDDING_MODEL) to turn it on.",
    );
  if (!isSpeechToTextEnabled())
    console.log(
      "ℹ️ Speech to text for meeting recordings is off: set STT_API_KEY (and optionally STT_API_URL, STT_MODEL). Pasted transcripts still work.",
    );
  return jobs;
}
