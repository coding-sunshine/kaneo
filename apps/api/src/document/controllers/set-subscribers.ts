import { and, eq, notInArray } from "drizzle-orm";
import { HTTPException } from "hono/http-exception";
import db from "../../database";
import { documentSubscriberTable } from "../../database/schema";
import { filterAssignableUsers } from "../../utils/assert-assignable-user";
import { loadDocument } from "./load-document";

// Replaces the subscriber list. Everyone added must be able to open the doc.
export async function setSubscribers(
  workspaceId: string,
  id: string,
  userId: string,
  userIds: string[],
) {
  await loadDocument(workspaceId, id, userId);
  const wanted = [...new Set(userIds)];
  const members = await filterAssignableUsers(wanted, workspaceId);
  for (const candidate of wanted) {
    const visible =
      members.has(candidate) &&
      (await loadDocument(workspaceId, id, candidate).then(
        () => true,
        () => false,
      ));
    if (!visible) {
      throw new HTTPException(400, {
        message: "Subscribers must be able to see the document",
      });
    }
  }

  await db.transaction(async (tx) => {
    await tx
      .delete(documentSubscriberTable)
      .where(
        and(
          eq(documentSubscriberTable.documentId, id),
          wanted.length
            ? notInArray(documentSubscriberTable.userId, wanted)
            : undefined,
        ),
      );
    if (wanted.length) {
      await tx
        .insert(documentSubscriberTable)
        .values(
          wanted.map((subscriber) => ({ documentId: id, userId: subscriber })),
        )
        .onConflictDoNothing();
    }
  });
  return { subscriberIds: wanted };
}
