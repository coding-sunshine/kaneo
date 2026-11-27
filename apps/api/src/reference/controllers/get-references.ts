import { and, asc, eq, isNull } from "drizzle-orm";
import db from "../../database";
import {
  documentTable,
  projectTable,
  type ReferencePlace,
  referenceTable,
  taskTable,
} from "../../database/schema";
import { documentVisibility } from "../../document/visibility";
import { projectAccessCondition } from "../../project-access/project-access-condition";

export type ReferenceTarget =
  | { taskId: string }
  | { documentId: string }
  | { projectId: string };

type Row = {
  id: string;
  title: string;
  key: string | null;
  open: boolean;
  place: ReferencePlace;
};

const targetCondition = (target: ReferenceTarget) =>
  "taskId" in target
    ? eq(referenceTable.targetTaskId, target.taskId)
    : "documentId" in target
      ? eq(referenceTable.targetDocumentId, target.documentId)
      : eq(referenceTable.targetProjectId, target.projectId);

// One entry per source, with every place it names the target in. A source the
// reader cannot open stays listed, unnamed, like a team they cannot enter.
function bySource(kind: "task" | "document", rows: Row[]) {
  const sources = new Map<string, Row & { places: ReferencePlace[] }>();
  for (const row of rows) {
    const source = sources.get(row.id);
    if (source) source.places.push(row.place);
    else sources.set(row.id, { ...row, places: [row.place] });
  }
  return [...sources.values()].map(({ id, title, key, open, places }) => ({
    kind,
    id,
    title: open ? title : null,
    key: open ? key : null,
    places: places.sort(),
  }));
}

/**
 * The tickets and documents of a workspace whose text names the target. The
 * caller has checked that the reader may open the target.
 */
export async function getReferences(
  workspaceId: string,
  target: ReferenceTarget,
  userId: string,
) {
  const where = and(
    eq(referenceTable.workspaceId, workspaceId),
    targetCondition(target),
  );
  const [tasks, documents] = await Promise.all([
    db
      .select({
        id: taskTable.id,
        title: taskTable.title,
        slug: projectTable.slug,
        number: taskTable.number,
        open: projectAccessCondition(userId, projectTable.id),
        place: referenceTable.place,
      })
      .from(referenceTable)
      .innerJoin(taskTable, eq(taskTable.id, referenceTable.sourceTaskId))
      .innerJoin(projectTable, eq(projectTable.id, taskTable.projectId))
      .where(and(where, eq(projectTable.workspaceId, workspaceId)))
      .orderBy(
        asc(projectTable.slug),
        asc(taskTable.number),
        asc(referenceTable.place),
      ),
    db
      .select({
        id: documentTable.id,
        title: documentTable.title,
        open: documentVisibility(userId, documentTable),
        place: referenceTable.place,
      })
      .from(referenceTable)
      .innerJoin(
        documentTable,
        eq(documentTable.id, referenceTable.sourceDocumentId),
      )
      .where(
        and(
          where,
          eq(documentTable.workspaceId, workspaceId),
          isNull(documentTable.deletedAt),
        ),
      )
      .orderBy(asc(documentTable.title), asc(documentTable.id)),
  ]);
  return {
    references: [
      ...bySource(
        "task",
        tasks.map(({ slug, number, ...row }) => ({
          ...row,
          open: Boolean(row.open),
          key: number === null ? null : `${slug.toUpperCase()}-${number}`,
        })),
      ),
      ...bySource(
        "document",
        documents.map((row) => ({
          ...row,
          open: Boolean(row.open),
          key: null,
        })),
      ),
    ],
  };
}
