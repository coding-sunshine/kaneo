import db from "../../database";
import { onboardingChecklistTable } from "../../database/schema";

export async function createChecklist(userId: string) {
  await db
    .insert(onboardingChecklistTable)
    .values({ userId })
    .onConflictDoNothing();
}
