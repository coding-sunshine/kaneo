import { eq } from "drizzle-orm";
import { internalAuthHeaders } from "../agent/internal-auth";
import type { ChatMessage } from "../agent/openrouter";
import { runAgent } from "../agent/run-agent";
import { createSelfClient } from "../agent/self-client";
import db from "../database";
import { loopRunTable, type loopTable } from "../database/schema";

// Runs the loop's instructions as its creator, using the creator's permissions
// at this moment. The transcript is stored on the run whether it works or not.
export async function executeLoop(
  loop: Pick<
    typeof loopTable.$inferSelect,
    "id" | "workspaceId" | "creatorId" | "instructions"
  >,
  trigger: "schedule" | "manual",
) {
  const [run] = await db
    .insert(loopRunTable)
    .values({ loopId: loop.id, trigger, status: "running" })
    .returning();
  if (!run) throw new Error("Run not created");

  const prompt: ChatMessage = { role: "user", content: loop.instructions };
  let messages: ChatMessage[] = [prompt];
  let error: string | null = null;
  try {
    messages = [
      prompt,
      ...(await runAgent(
        [prompt],
        createSelfClient(internalAuthHeaders(loop.creatorId)),
        loop.workspaceId,
      )),
    ];
  } catch (caught) {
    error = caught instanceof Error ? caught.message : "The run failed";
  }
  const [finished] = await db
    .update(loopRunTable)
    .set({
      status: error ? "failed" : "succeeded",
      error,
      messages,
      finishedAt: new Date(),
    })
    .where(eq(loopRunTable.id, run.id))
    .returning();
  return finished ?? run;
}
