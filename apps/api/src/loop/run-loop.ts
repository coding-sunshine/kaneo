import { AsyncLocalStorage } from "node:async_hooks";
import { eq } from "drizzle-orm";
import type { ChatMessage } from "../agent/openrouter";
import { runAgent } from "../agent/run-agent";
import { createSelfClient } from "../agent/self-client";
import db from "../database";
import { loopRunTable, type loopTable } from "../database/schema";

// Set while a loop runs. Changes the agent makes (a comment, a new issue) emit
// events of their own; event loops ignore them so loops cannot trigger loops.
export const loopRunContext = new AsyncLocalStorage<true>();

// Runs the loop's instructions as its creator, using the creator's permissions
// at this moment. The transcript is stored on the run whether it works or not.
export async function executeLoop(
  loop: Pick<
    typeof loopTable.$inferSelect,
    "id" | "workspaceId" | "creatorId" | "instructions" | "actions"
  >,
  trigger: "schedule" | "manual" | "event",
  eventNote?: string,
) {
  const [run] = await db
    .insert(loopRunTable)
    .values({ loopId: loop.id, trigger, status: "running" })
    .returning();
  if (!run) throw new Error("Run not created");

  const prompt: ChatMessage = {
    role: "user",
    content: eventNote
      ? `${loop.instructions}\n\n<event>${eventNote}</event>`
      : loop.instructions,
  };
  let messages: ChatMessage[] = [prompt];
  let error: string | null = null;
  try {
    messages = [
      prompt,
      ...(await loopRunContext.run(true, () =>
        runAgent(
          [prompt],
          createSelfClient(new Headers(), loop.creatorId),
          loop.workspaceId,
          undefined,
          {
            writes: loop.actions,
            unattended: true,
            meter: { userId: loop.creatorId, purpose: "loop" },
          },
        ),
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
