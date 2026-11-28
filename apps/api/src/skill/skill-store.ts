import { and, asc, eq, inArray } from "drizzle-orm";
import { HTTPException } from "hono/http-exception";
import db from "../database";
import { aiSkillProjectTable, aiSkillTable } from "../database/schema";
import { openProjectIds } from "./open-projects";

type Owner = { workspaceId: string; userId: string };

const ownedBy = ({ workspaceId, userId }: Owner) =>
  and(
    eq(aiSkillTable.workspaceId, workspaceId),
    eq(aiSkillTable.userId, userId),
  );

async function withProjects(skills: (typeof aiSkillTable.$inferSelect)[]) {
  const rows = skills.length
    ? await db
        .select()
        .from(aiSkillProjectTable)
        .where(
          inArray(
            aiSkillProjectTable.skillId,
            skills.map((skill) => skill.id),
          ),
        )
    : [];
  return skills.map((skill) => ({
    id: skill.id,
    name: skill.name,
    prompt: skill.prompt,
    projectIds:
      skill.projectScope === "selected"
        ? rows
            .filter((row) => row.skillId === skill.id)
            .map((row) => row.projectId)
        : null,
    monthlyTokenCap: skill.monthlyTokenCap,
    createdAt: skill.createdAt.toISOString(),
  }));
}

/** The owner's skills; nobody else sees them. */
export async function listSkills(owner: Owner) {
  const skills = await db
    .select()
    .from(aiSkillTable)
    .where(ownedBy(owner))
    .orderBy(asc(aiSkillTable.name));
  return { skills: await withProjects(skills) };
}

/** The owner's skill, or 404 for anyone else's or a missing one. */
export async function loadOwnSkill(owner: Owner, skillId: string) {
  const [skill] = await db
    .select()
    .from(aiSkillTable)
    .where(and(ownedBy(owner), eq(aiSkillTable.id, skillId)));
  if (!skill) throw new HTTPException(404, { message: "Skill not found" });
  return (await withProjects([skill]))[0] as NonNullable<
    Awaited<ReturnType<typeof withProjects>>[number]
  >;
}

export async function createSkill(
  owner: Owner,
  input: {
    name: string;
    prompt: string;
    projectIds?: string[] | null;
    monthlyTokenCap?: number | null;
  },
) {
  const projectIds = input.projectIds ? [...new Set(input.projectIds)] : null;
  if (projectIds) {
    const open = await openProjectIds(
      owner.workspaceId,
      owner.userId,
      projectIds,
    );
    if (open.length !== projectIds.length)
      throw new HTTPException(404, { message: "Project not found" });
  }
  const [existing] = await db
    .select({ id: aiSkillTable.id })
    .from(aiSkillTable)
    .where(and(ownedBy(owner), eq(aiSkillTable.name, input.name)));
  if (existing)
    throw new HTTPException(409, {
      message: `You already have a skill named ${input.name}`,
    });
  const skill = await db.transaction(async (tx) => {
    const [row] = await tx
      .insert(aiSkillTable)
      .values({
        ...owner,
        name: input.name,
        prompt: input.prompt,
        projectScope: projectIds ? "selected" : "all",
        monthlyTokenCap: input.monthlyTokenCap ?? null,
      })
      .returning();
    if (!row) throw new HTTPException(500, { message: "Skill not saved" });
    if (projectIds?.length)
      await tx
        .insert(aiSkillProjectTable)
        .values(
          projectIds.map((projectId) => ({ skillId: row.id, projectId })),
        );
    return row;
  });
  return loadOwnSkill(owner, skill.id);
}

export async function deleteSkill(owner: Owner, skillId: string) {
  await loadOwnSkill(owner, skillId);
  await db
    .delete(aiSkillTable)
    .where(and(ownedBy(owner), eq(aiSkillTable.id, skillId)));
  return { deleted: true as const };
}
