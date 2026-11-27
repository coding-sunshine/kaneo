import type { InitiativeUpdate } from "@/fetchers/initiative/types";
import type { WorkProjectUpdate } from "@/fetchers/work-project/types";

export type PulseEntry =
  | { kind: "project"; update: WorkProjectUpdate }
  | { kind: "initiative"; update: InitiativeUpdate };

/** Project and initiative updates in one feed, newest first. */
export function mergePulse(
  projectUpdates: WorkProjectUpdate[],
  initiativeUpdates: InitiativeUpdate[],
): PulseEntry[] {
  return [
    ...projectUpdates.map((update) => ({ kind: "project" as const, update })),
    ...initiativeUpdates.map((update) => ({
      kind: "initiative" as const,
      update,
    })),
  ].sort((a, b) => b.update.createdAt.localeCompare(a.update.createdAt));
}
