import { and, eq } from "drizzle-orm";
import db from "../../database";
import {
  onboardingChecklistTable as checklist,
  taskTable,
  workspaceUserTable,
} from "../../database/schema";
import { openChecklist } from "../open-checklist";
import { CHECKLIST_ITEMS } from "../items";

// The caller's open checklist. Links into the welcome workspace are dropped
// once the caller is no longer a member of it.
export async function getChecklist(userId: string) {
  const [row] = await db
    .select({
      workspaceId: checklist.workspaceId,
      handbookDocumentId: checklist.handbookDocumentId,
      welcomeChannelId: checklist.welcomeChannelId,
      sampleTaskId: checklist.sampleTaskId,
      sampleProjectId: taskTable.projectId,
      completedItems: checklist.completedItems,
      member: workspaceUserTable.userId,
    })
    .from(checklist)
    .leftJoin(taskTable, eq(taskTable.id, checklist.sampleTaskId))
    .leftJoin(
      workspaceUserTable,
      and(
        eq(workspaceUserTable.workspaceId, checklist.workspaceId),
        eq(workspaceUserTable.userId, userId),
      ),
    )
    .where(openChecklist(userId));
  if (!row) return null;

  const items = CHECKLIST_ITEMS.map((id) => ({
    id,
    done: row.completedItems.includes(id),
  }));
  if (!row.member)
    return {
      workspaceId: null,
      handbookDocumentId: null,
      welcomeChannelId: null,
      sampleTask: null,
      items,
    };
  return {
    workspaceId: row.workspaceId,
    handbookDocumentId: row.handbookDocumentId,
    welcomeChannelId: row.welcomeChannelId,
    sampleTask:
      row.sampleTaskId && row.sampleProjectId
        ? { id: row.sampleTaskId, projectId: row.sampleProjectId }
        : null,
    items,
  };
}
