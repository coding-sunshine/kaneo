import { HTTPException } from "hono/http-exception";
import db from "../../database";
import { onboardingChecklistTable as checklist } from "../../database/schema";
import { openChecklist } from "../open-checklist";

export async function dismissChecklist(userId: string) {
  const [row] = await db
    .update(checklist)
    .set({ dismissedAt: new Date() })
    .where(openChecklist(userId))
    .returning({ userId: checklist.userId });
  if (!row) throw new HTTPException(404, { message: "No open checklist" });
  return { dismissed: true as const };
}
