import { and, eq } from "drizzle-orm";
import { beforeEach, describe, expect, it } from "vite-plus/test";
import db, { schema } from "../../apps/api/src/database";
import { resetTestDatabase } from "./helpers/database";
import {
  buildDocumentWorld,
  type DocumentPlace,
  type DocumentWorld,
  json,
  SEARCH_WORD,
} from "./helpers/document-access/build-document-world";

type Member = DocumentWorld["owner"];

const one = (world: DocumentWorld, place: DocumentPlace) =>
  `/document/workspace/${world.ws}/${world.docs[place]}`;

async function opens(world: DocumentWorld, user: Member, place: DocumentPlace) {
  const response = await world.as(user)(one(world, place));
  if (response.status !== 200) return response.status;
  return ((await response.json()) as { role: string }).role;
}

const link = (workProjectId: string, projectId: string) =>
  db.insert(schema.workProjectTeamTable).values({ workProjectId, projectId });
const unlink = (workProjectId: string, projectId: string) =>
  db
    .delete(schema.workProjectTeamTable)
    .where(
      and(
        eq(schema.workProjectTeamTable.workProjectId, workProjectId),
        eq(schema.workProjectTeamTable.projectId, projectId),
      ),
    );

describe("API integration: project documents follow the project's teams", () => {
  beforeEach(async () => {
    await resetTestDatabase();
  });

  it("opens a project document to the members of any of the project's teams", async () => {
    const world = await buildDocumentWorld();
    const { limited, open, alpha, beta, betaProject } = world;

    // No team: the whole workspace. One team: the people who can enter it.
    expect(await opens(world, limited, "project")).toBe("edit");
    expect(await opens(world, limited, "projectAlpha")).toBe("edit");
    expect(await opens(world, limited, "projectBeta")).toBe(404);
    for (const place of ["project", "projectAlpha", "projectBeta"] as const) {
      expect({ place, role: await opens(world, open, place) }).toEqual({
        place,
        role: "edit",
      });
    }

    // One team the member can enter is enough.
    await link(betaProject.id, alpha.id);
    expect(await opens(world, limited, "projectBeta")).toBe("edit");
    await unlink(betaProject.id, alpha.id);
    expect(await opens(world, limited, "projectBeta")).toBe(404);

    // A project that loses its last team is open to the workspace again.
    await unlink(betaProject.id, beta.id);
    expect(await opens(world, limited, "projectBeta")).toBe("edit");
  });

  it("applies the same rule to the list, search and notifications", async () => {
    const world = await buildDocumentWorld();
    const { limited, open, owner, betaProject } = world;
    const inProject = async (user: Member) => {
      const response = await world.as(user)(
        `/document/workspace/${world.ws}?workProjectId=${betaProject.id}`,
      );
      return ((await response.json()) as { id: string }[])
        .map((row) => row.id)
        .sort();
    };
    // `limited` sees only the document shared with them by name.
    expect(await inProject(limited)).toEqual([world.docs.sharedInProjectBeta]);
    expect(await inProject(open)).toEqual(
      [world.docs.projectBeta, world.docs.sharedInProjectBeta].sort(),
    );

    const found = async (user: Member) => {
      const response = await world.as(user)(
        `/search?q=${SEARCH_WORD}&workspaceId=${world.ws}&type=documents&limit=50`,
      );
      const body = (await response.json()) as { results: { id: string }[] };
      return body.results.map((result) => result.id);
    };
    expect(await found(limited)).not.toContain(world.docs.projectBeta);
    expect(await found(limited)).toContain(world.docs.projectAlpha);
    expect(await found(open)).toContain(world.docs.projectBeta);

    const mention = (user: Member) =>
      `<p><kaneo-mention id="${user.id}">@them</kaneo-mention> look</p>`;
    for (const place of ["projectAlpha", "projectBeta"] as const) {
      const response = await world.as(owner)(
        `${one(world, place)}/comments`,
        json("POST", { content: mention(limited) + mention(open) }),
      );
      expect(response.status).toBe(200);
    }
    const notified = async (user: Member) =>
      (
        await db
          .select({ resourceId: schema.notificationTable.resourceId })
          .from(schema.notificationTable)
          .where(
            and(
              eq(schema.notificationTable.userId, user.id),
              eq(schema.notificationTable.resourceType, "document"),
            ),
          )
      )
        .map((row) => row.resourceId)
        .sort();
    expect(await notified(limited)).toEqual([world.docs.projectAlpha]);
    expect(await notified(open)).toEqual(
      [world.docs.projectAlpha, world.docs.projectBeta].sort(),
    );
  });

  it("refuses to place a document in a project whose teams the member cannot enter", async () => {
    const world = await buildDocumentWorld();
    const { limited, open, workProject, alphaProject, betaProject } = world;
    const create = (user: Member, workProjectId: string) =>
      world.as(user)(
        "/document",
        json("POST", { workspaceId: world.ws, title: "Notes", workProjectId }),
      );

    expect((await create(limited, workProject.id)).status).toBe(200);
    expect((await create(limited, alphaProject.id)).status).toBe(200);
    // A project they cannot enter answers like one that does not exist.
    expect((await create(limited, betaProject.id)).status).toBe(400);
    expect((await create(open, betaProject.id)).status).toBe(200);
    expect((await create(limited, "no-such-project")).status).toBe(400);

    const draft = (await (
      await world.as(limited)(
        "/document",
        json("POST", { workspaceId: world.ws, title: "Draft" }),
      )
    ).json()) as { id: string };
    const move = (workProjectId: string) =>
      world.as(limited)(
        `/document/workspace/${world.ws}/${draft.id}/location`,
        json("PUT", { scope: "project", workProjectId }),
      );
    expect((await move(betaProject.id)).status).toBe(400);
    const [unmoved] = await db
      .select({
        scope: schema.documentTable.scope,
        workProjectId: schema.documentTable.workProjectId,
      })
      .from(schema.documentTable)
      .where(eq(schema.documentTable.id, draft.id));
    expect(unmoved).toEqual({ scope: "private", workProjectId: null });
    expect((await move(alphaProject.id)).status).toBe(200);
  });

  it("gives a named share its own role inside a closed project", async () => {
    const world = await buildDocumentWorld();
    const { limited, alpha, betaProject } = world;
    expect(await opens(world, limited, "sharedInProjectBeta")).toBe("view");
    expect(
      (
        await world.as(limited)(
          one(world, "sharedInProjectBeta"),
          json("PATCH", { title: "taken" }),
        )
      ).status,
    ).toBe(403);

    // Once they can enter one of the project's teams, the place's role applies.
    await link(betaProject.id, alpha.id);
    expect(await opens(world, limited, "sharedInProjectBeta")).toBe("edit");
  });
});
