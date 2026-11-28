import { sql } from "drizzle-orm";
import db from "../../database";
import { onboardingChecklistTable as checklist } from "../../database/schema";
import { openChecklist } from "../open-checklist";
import type { ChecklistItem } from "../items";

// Ticks an item on the user's open checklist. False when there is none.
export async function markChecklistItem(userId: string, item: ChecklistItem) {
  const [row] = await db
    .update(checklist)
    .set({
      completedItems: sql`CASE WHEN ${item}::text = ANY(${checklist.completedItems}) THEN ${checklist.completedItems} ELSE array_append(${checklist.completedItems}, ${item}::text) END`,
    })
    .where(openChecklist(userId))
    .returning({ userId: checklist.userId });
  return Boolean(row);
}
