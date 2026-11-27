import { and, eq, isNotNull, not } from "drizzle-orm";
import { beforeEach, describe, expect, it, vi } from "vite-plus/test";
import db, { schema } from "../../apps/api/src/database";
import { projectAccessCondition } from "../../apps/api/src/project-access/project-access-condition";
import { resetTestDatabase } from "./helpers/database";
import {
  buildDocumentWorld,
  type DocumentWorld,
  json,
} from "./helpers/document-access/build-document-world";

// Holds an assign between its access check and its write, until the privacy
// change has finished or a short wait has passed. The wait ends on its own,
// so an assign that keeps the privacy change waiting still finishes.
const gate = vi.hoisted(() => ({
  checked: () => {},
  privacyDone: Promise.resolve(),
}));
vi.mock(
  "../../apps/api/src/utils/assert-assignable-user",
  async (importOriginal) => {
    const original =
      await importOriginal<
        typeof import("../../apps/api/src/utils/assert-assignable-user")
      >();
    return {
      ...original,
      assertAssignableUser: async (
        ...args: Parameters<typeof original.assertAssignableUser>
      ) => {
        await original.assertAssignableUser(...args);
        gate.checked();
        await Promise.race([
          gate.privacyDone,
          new Promise((resolve) => setTimeout(resolve, 800)),
        ]);
      },
    };
  },
);

let world: DocumentWorld;

beforeEach(async () => {
  await resetTestDatabase();
  world = await buildDocumentWorld();
});

const outsiderAssignees = () =>
  db
    .select({ id: schema.taskTable.id, userId: schema.taskTable.userId })
    .from(schema.taskTable)
    .where(
      and(
        eq(schema.taskTable.projectId, world.alpha.id),
        isNotNull(schema.taskTable.userId),
        not(
          projectAccessCondition(
            schema.taskTable.userId,
            schema.taskTable.projectId,
          ),
        ),
      ),
    );

describe("private teams: an assign racing the privacy change", () => {
  it("leaves no issue assigned to someone who cannot open the team", async () => {
    const ask = world.as(world.owner);
    const checked = new Promise<void>((resolve) => {
      gate.checked = resolve;
    });
    let finishPrivacy = () => {};
    gate.privacyDone = new Promise<void>((resolve) => {
      finishPrivacy = resolve;
    });

    // `open` may enter Alpha until it goes private.
    const assign = ask(
      `/task/assignee/${world.alphaTask.id}`,
      json("PUT", { userId: world.open.id }),
    );
    await checked;
    const team = world.alpha;
    const privacy = Promise.resolve(
      ask(
        `/project/${team.id}`,
        json("PUT", {
          name: team.name,
          icon: team.icon,
          slug: team.slug,
          description: team.description ?? "",
          isPublic: false,
          isPrivate: true,
          confirmPrivate: true,
        }),
      ),
    ).finally(finishPrivacy);

    const [assigned, madePrivate] = await Promise.all([assign, privacy]);
    expect(madePrivate.status).toBe(200);
    expect([200, 403]).toContain(assigned.status);
    expect(await outsiderAssignees()).toEqual([]);
  });
});
