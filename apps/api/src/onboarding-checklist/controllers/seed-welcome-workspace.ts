import { createId } from "@paralleldrive/cuid2";
import { and, eq, isNull } from "drizzle-orm";
import { createChannel } from "../../chat/controllers/create-channel";
import db from "../../database";
import {
  onboardingChecklistTable as checklist,
  workspaceUserTable,
} from "../../database/schema";
import { createDocument } from "../../document/controllers/create-document";
import { insertProject } from "../../project/controllers/insert-project";
import createTask from "../../task/controllers/create-task";
import { getUserPendingInvitations } from "../../utils/check-registration-allowed";
import { canCreateWorkspace } from "../../workspace/can-create-workspace";
import { WELCOME_WORKSPACE } from "../welcome-content";

type CreateWorkspace = (input: {
  name: string;
  slug: string;
  userId: string;
}) => Promise<{ id: string } | null>;

// Someone new with nowhere to go: no workspace yet, no invitation waiting,
// and allowed to make a workspace of their own.
async function needsWelcomeWorkspace(userId: string, email: string) {
  const [membership] = await db
    .select({ workspaceId: workspaceUserTable.workspaceId })
    .from(workspaceUserTable)
    .where(eq(workspaceUserTable.userId, userId))
    .limit(1);
  if (membership) return false;
  if ((await getUserPendingInvitations(email)).length > 0) return false;
  return canCreateWorkspace(userId);
}

// Claims the caller's checklist so that two tabs cannot seed twice.
async function claimChecklist(userId: string) {
  const [row] = await db
    .update(checklist)
    .set({ seededAt: new Date() })
    .where(
      and(
        eq(checklist.userId, userId),
        isNull(checklist.seededAt),
        isNull(checklist.dismissedAt),
      ),
    )
    .returning({ userId: checklist.userId });
  return Boolean(row);
}

async function seedContent(
  userId: string,
  workspaceId: string,
): Promise<Partial<typeof checklist.$inferInsert>> {
  const project = await db.transaction((tx) =>
    insertProject(tx, { workspaceId, userId, ...WELCOME_WORKSPACE.project }),
  );
  const task = project
    ? await createTask({
        projectId: project.id,
        currentUserId: userId,
        userId,
        status: "to-do",
        ...WELCOME_WORKSPACE.sampleTask,
      })
    : null;
  const channel = await createChannel(workspaceId, userId, {
    ...WELCOME_WORKSPACE.channel,
    isPrivate: false,
  });
  const handbook = await createDocument(userId, {
    workspaceId,
    scope: "workspace",
    ...WELCOME_WORKSPACE.handbook,
  });
  return {
    workspaceId,
    handbookDocumentId: handbook.id,
    welcomeChannelId: channel.id,
    sampleTaskId: task?.id ?? null,
  };
}

// Makes a new hire's welcome workspace with a handbook page, a #welcome
// channel and a sample ticket, and opens their checklist. Returns the
// workspace, or null when the person does not get one.
export async function seedWelcomeWorkspace(
  user: { id: string; email: string },
  createWorkspace: CreateWorkspace,
) {
  if (!(await needsWelcomeWorkspace(user.id, user.email))) return null;
  if (!(await claimChecklist(user.id))) return null;
  try {
    const workspace = await createWorkspace({
      name: WELCOME_WORKSPACE.name,
      slug: `welcome-${createId()}`,
      userId: user.id,
    });
    if (!workspace) throw new Error("Workspace creation returned nothing");
    await db
      .update(checklist)
      .set(await seedContent(user.id, workspace.id))
      .where(eq(checklist.userId, user.id));
    return workspace.id;
  } catch (error) {
    await db
      .update(checklist)
      .set({ seededAt: null })
      .where(eq(checklist.userId, user.id));
    throw error;
  }
}
