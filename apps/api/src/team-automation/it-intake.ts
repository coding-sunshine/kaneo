import { and, eq, max } from "drizzle-orm";
import { HTTPException } from "hono/http-exception";
import db from "../database";
import {
  customFieldDefinitionTable,
  issueTemplateTable,
  projectTable,
  savedViewTable,
} from "../database/schema";
import { publishEvent } from "../events";
import { ensureTriageColumn } from "./ensure-triage-column";

const IT_CATEGORY_OPTIONS = [
  "Hardware",
  "Software",
  "Access",
  "Network",
  "Other",
];

/**
 * Turns a team into an IT service desk: a Triage status, a required Category
 * dropdown, an "IT request" template that files high priority requests into
 * Triage, SLAs on, and a shared "IT queue" view of Triage. Running it again
 * reuses what is there, so people's later edits survive.
 */
export async function setUpItIntake(projectId: string, userId: string) {
  const result = await db.transaction(async (tx) => {
    const [project] = await tx
      .select({
        workspaceId: projectTable.workspaceId,
        slaEnabled: projectTable.slaEnabled,
      })
      .from(projectTable)
      .where(eq(projectTable.id, projectId));
    if (!project) throw new HTTPException(404, { message: "Team not found" });

    const columnId = await ensureTriageColumn(tx, projectId);

    let [field] = await tx
      .select({ id: customFieldDefinitionTable.id })
      .from(customFieldDefinitionTable)
      .where(
        and(
          eq(customFieldDefinitionTable.projectId, projectId),
          eq(customFieldDefinitionTable.name, "Category"),
        ),
      );
    if (!field) {
      const [last] = await tx
        .select({ position: max(customFieldDefinitionTable.position) })
        .from(customFieldDefinitionTable)
        .where(eq(customFieldDefinitionTable.projectId, projectId));
      [field] = await tx
        .insert(customFieldDefinitionTable)
        .values({
          projectId,
          name: "Category",
          type: "dropdown",
          required: true,
          options: IT_CATEGORY_OPTIONS,
          position: (last?.position ?? 0) + 1,
        })
        .returning({ id: customFieldDefinitionTable.id });
    }

    let [template] = await tx
      .select({ id: issueTemplateTable.id })
      .from(issueTemplateTable)
      .where(
        and(
          eq(issueTemplateTable.projectId, projectId),
          eq(issueTemplateTable.name, "IT request"),
        ),
      );
    if (!template) {
      const [last] = await tx
        .select({ position: max(issueTemplateTable.position) })
        .from(issueTemplateTable)
        .where(eq(issueTemplateTable.projectId, projectId));
      [template] = await tx
        .insert(issueTemplateTable)
        .values({
          projectId,
          name: "IT request",
          columnId,
          priority: "high",
          position: (last?.position ?? -1) + 1,
        })
        .returning({ id: issueTemplateTable.id });
    }

    let [view] = await tx
      .select({ id: savedViewTable.id })
      .from(savedViewTable)
      .where(
        and(
          eq(savedViewTable.projectId, projectId),
          eq(savedViewTable.name, "IT queue"),
          eq(savedViewTable.visibility, "shared"),
        ),
      );
    if (!view) {
      [view] = await tx
        .insert(savedViewTable)
        .values({
          workspaceId: project.workspaceId,
          projectId,
          ownerId: userId,
          visibility: "shared",
          name: "IT queue",
          filters: { status: ["triage"] },
          display: { layout: "list", preset: "it-queue" },
        })
        .returning({ id: savedViewTable.id });
    }

    if (!project.slaEnabled)
      await tx
        .update(projectTable)
        .set({ slaEnabled: true })
        .where(eq(projectTable.id, projectId));

    if (!columnId || !field || !template || !view)
      throw new HTTPException(500, { message: "Failed to set up IT intake" });
    return {
      columnId,
      fieldId: field.id,
      templateId: template.id,
      viewId: view.id,
    };
  });
  await publishEvent("project.updated", { projectId });
  return result;
}
