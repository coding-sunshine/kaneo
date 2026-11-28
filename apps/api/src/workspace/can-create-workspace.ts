import { eq } from "drizzle-orm";
import db, { schema } from "../database";
import { getInstanceSettings } from "../instance-settings/get-instance-settings";
import { hasInstanceAdminRole } from "../utils/instance-admin-role";

// When workspace creation is restricted (instance setting or
// `DISABLE_WORKSPACE_CREATION`), only instance admins may create workspaces.
// Reads the current instance role rather than a session's user snapshot,
// which can predate first-user promotion or an administrator's changes.
export async function canCreateWorkspace(userId: string) {
  if (!(await getInstanceSettings()).workspaceCreationRestricted) return true;
  const [user] = await db
    .select({ role: schema.userTable.role })
    .from(schema.userTable)
    .where(eq(schema.userTable.id, userId));
  return hasInstanceAdminRole(user?.role);
}
