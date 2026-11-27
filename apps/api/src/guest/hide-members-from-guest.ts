import { and, eq } from "drizzle-orm";
import db from "../database";
import { workspaceUserTable } from "../database/schema";
import { isWorkspaceGuest } from "./is-workspace-guest";
import { sharesProjectCondition } from "./shares-project-condition";

type MemberList = {
  members?: { userId?: unknown; organizationId?: unknown }[];
  total?: number;
};

// Trims a Better Auth member list for a guest to the people of their own
// projects, so the app's pickers keep working without a directory.
export async function hideMembersFromGuest(
  viewerId: string,
  returned: unknown,
) {
  const list = returned as MemberList | null;
  const members = Array.isArray(list?.members) ? list.members : null;
  const workspaceId = members?.[0]?.organizationId;
  if (!list || !members || typeof workspaceId !== "string") return;
  if (!(await isWorkspaceGuest(workspaceId, viewerId))) return;

  const rows = await db
    .select({ userId: workspaceUserTable.userId })
    .from(workspaceUserTable)
    .where(
      and(
        eq(workspaceUserTable.workspaceId, workspaceId),
        sharesProjectCondition(
          viewerId,
          workspaceUserTable.userId,
          workspaceId,
        ),
      ),
    );
  const visible = new Set([viewerId, ...rows.map((row) => row.userId)]);
  const kept = members.filter(
    (member) => typeof member.userId === "string" && visible.has(member.userId),
  );
  members.splice(0, members.length, ...kept);
  if (typeof list.total === "number") list.total = kept.length;
}
