import { and, eq, inArray } from "drizzle-orm";
import { HTTPException } from "hono/http-exception";
import db from "../database";
import {
  workspaceMemberAccessTable,
  workspaceUserTable,
} from "../database/schema";
import { worksWithGuestCondition } from "./works-with-guest-condition";

// A direct message may hold a guest only together with people who share one
// of the guest's projects or channels. Anyone else answers like an unknown
// person, so a guest learns nothing about the rest of the workspace.
export async function assertGuestsWorkWithMembers(
  workspaceId: string,
  memberIds: string[],
) {
  const guests = await db
    .select({ userId: workspaceMemberAccessTable.userId })
    .from(workspaceMemberAccessTable)
    .where(
      and(
        eq(workspaceMemberAccessTable.workspaceId, workspaceId),
        inArray(workspaceMemberAccessTable.userId, memberIds),
        eq(workspaceMemberAccessTable.guest, true),
      ),
    );
  for (const { userId: guestId } of guests) {
    const others = memberIds.filter((id) => id !== guestId);
    const shared = await db
      .select({ userId: workspaceUserTable.userId })
      .from(workspaceUserTable)
      .where(
        and(
          eq(workspaceUserTable.workspaceId, workspaceId),
          inArray(workspaceUserTable.userId, others),
          worksWithGuestCondition(
            guestId,
            workspaceUserTable.userId,
            workspaceId,
          ),
        ),
      );
    if (shared.length !== others.length)
      throw new HTTPException(404, { message: "Member not found" });
  }
}
