import type { z } from "../../openapi";
import db from "../../database";
import { userProfileTable } from "../../database/schema";
import { markChecklistItem } from "../../onboarding-checklist/controllers/mark-checklist-item";
import type { updateProfileBody } from "../profile/profile-schema";
import getOwnProfile from "./get-own-profile";

type ProfileUpdate = z.infer<typeof updateProfileBody>;

// Only keys present in the body change; null clears one.
function toColumns({ status, outOfOffice, ...fields }: ProfileUpdate) {
  const columns: Partial<typeof userProfileTable.$inferInsert> = {};
  for (const [key, value] of Object.entries(fields)) {
    if (value !== undefined) Object.assign(columns, { [key]: value });
  }
  if (outOfOffice !== undefined) {
    columns.outOfOfficeFrom = outOfOffice ? new Date(outOfOffice.from) : null;
    columns.outOfOfficeUntil = outOfOffice ? new Date(outOfOffice.until) : null;
  }
  if (status !== undefined) {
    columns.statusText = status?.text ?? null;
    const clearsAt =
      status?.clearsAt === undefined ? outOfOffice?.until : status.clearsAt;
    columns.statusClearsAt = clearsAt ? new Date(clearsAt) : null;
  }
  return columns;
}

async function updateOwnProfile(userId: string, update: ProfileUpdate) {
  const columns = toColumns(update);
  await db
    .insert(userProfileTable)
    .values({ userId, ...columns })
    .onConflictDoUpdate({
      target: userProfileTable.userId,
      set: { ...columns, updatedAt: new Date() },
    });
  if (columns.statusText) await markChecklistItem(userId, "set-status");
  return getOwnProfile(userId);
}

export default updateOwnProfile;
