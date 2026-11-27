import { and, eq } from "drizzle-orm";
import db, { schema } from "../database";
import type { DbOrTx } from "../project-access/db-or-tx";

const rules = schema.workspaceMemberAccessTable;

export async function isWorkspaceGuest(
  workspaceId: string,
  userId: string,
  database: DbOrTx = db,
) {
  const [rule] = await database
    .select({ guest: rules.guest })
    .from(rules)
    .where(and(eq(rules.workspaceId, workspaceId), eq(rules.userId, userId)))
    .limit(1);
  return rule?.guest === true;
}
