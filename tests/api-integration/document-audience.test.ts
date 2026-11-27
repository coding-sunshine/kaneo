import { eq } from "drizzle-orm";
import { beforeEach, describe, expect, it } from "vite-plus/test";
import db, { schema } from "../../apps/api/src/database";
import { resetTestDatabase } from "./helpers/database";
import {
  buildDocumentWorld,
  type DocumentPlace,
  type DocumentWorld,
} from "./helpers/document-access/build-document-world";
import { addWorkspaceMember } from "./helpers/project-access/add-workspace-member";

type Member = DocumentWorld["owner"];
type Audience = {
  current: { userId: string; name: string; image: string | null }[];
  proposed: { userId: string }[] | null;
};

const one = (world: DocumentWorld, place: DocumentPlace) =>
  `/document/workspace/${world.ws}/${world.docs[place]}`;
const ask = (
  world: DocumentWorld,
  user: Member,
  place: DocumentPlace,
  target: Record<string, string> = {},
) =>
  world.as(user)(
    `${one(world, place)}/audience?${new URLSearchParams(target)}`,
  );
const sorted = (people: { userId: string }[] | null) =>
  people?.map((person) => person.userId).sort() ?? null;
const members = (...users: Member[]) => users.map((user) => user.id).sort();

describe("API integration: the audience of a document", () => {
  beforeEach(async () => {
    await resetTestDatabase();
  });

  it("names exactly the people who can open the document", async () => {
    const world = await buildDocumentWorld();
    const { owner, limited, open } = world;
    for (const place of Object.keys(world.docs) as DocumentPlace[]) {
      const canOpen: Member[] = [];
      for (const user of [owner, limited, open]) {
        const { status } = await world.as(user)(one(world, place));
        if (status === 200) canOpen.push(user);
      }
      const response = await ask(world, owner, place);
      expect(response.status).toBe(200);
      const audience = (await response.json()) as Audience;
      expect({ place, current: sorted(audience.current) }).toEqual({
        place,
        current: members(...canOpen),
      });
      expect(audience.proposed).toBeNull();
    }

    const audience = (await (
      await ask(world, limited, "sharedByName")
    ).json()) as Audience;
    expect(sorted(audience.current)).toEqual(members(owner, limited));
    expect(
      audience.current.find((person) => person.userId === owner.id),
    ).toEqual({ userId: owner.id, name: owner.name, image: owner.image });
  });

  it("leaves out members whose role cannot read, and banned members", async () => {
    const world = await buildDocumentWorld();
    await db.insert(schema.workspaceRoleTable).values({
      workspaceId: world.ws,
      role: "outsider",
      permission: JSON.stringify({ project: ["read"] }),
    });
    const outsider = await addWorkspaceMember(world.ws, "outsider");
    const banned = await addWorkspaceMember(world.ws);
    await db
      .update(schema.userTable)
      .set({ banned: true })
      .where(eq(schema.userTable.id, banned.id));
    expect((await world.as(outsider)(one(world, "workspace"))).status).toBe(
      403,
    );

    const audience = (await (
      await ask(world, world.owner, "workspace")
    ).json()) as Audience;
    expect(sorted(audience.current)).toEqual(
      members(world.owner, world.limited, world.open),
    );
  });

  it("names who could open the document after a move, without moving it", async () => {
    const world = await buildDocumentWorld();
    const { owner, limited, open } = world;
    const everyone = members(owner, limited, open);
    const after = async (
      place: DocumentPlace,
      target: Record<string, string>,
    ) => {
      const response = await ask(world, owner, place, target);
      expect({ place, target, status: response.status }).toEqual({
        place,
        target,
        status: 200,
      });
      return sorted(((await response.json()) as Audience).proposed);
    };

    expect(await after("private", { scope: "workspace" })).toEqual(everyone);
    expect(await after("private", { projectId: world.alpha.id })).toEqual(
      everyone,
    );
    expect(await after("teamAlpha", { projectId: world.beta.id })).toEqual(
      members(owner, open),
    );
    expect(await after("teamAlpha", { taskId: world.betaTask.id })).toEqual(
      members(owner, open),
    );
    expect(
      await after("workspace", { workProjectId: world.betaProject.id }),
    ).toEqual(members(owner, open));
    expect(
      await after("teamBeta", { workProjectId: world.workProject.id }),
    ).toEqual(everyone);
    // A share by name goes with the document to its new place.
    expect(await after("sharedByName", { projectId: world.beta.id })).toEqual(
      everyone,
    );
    // Back to private drops every share: only the author is left.
    expect(await after("sharedInBeta", { scope: "private" })).toEqual(
      members(owner),
    );

    const [unmoved] = await db
      .select({
        scope: schema.documentTable.scope,
        projectId: schema.documentTable.projectId,
      })
      .from(schema.documentTable)
      .where(eq(schema.documentTable.id, world.docs.teamAlpha));
    expect(unmoved).toEqual({ scope: "team", projectId: world.alpha.id });
  });

  it("only answers a person who can open the document, about a place they can enter", async () => {
    const world = await buildDocumentWorld();
    const { limited } = world;
    const unknown = await world.as(limited)(
      `/document/workspace/${world.ws}/no-such-document/audience`,
    );
    expect(unknown.status).toBe(404);
    const unknownBody = await unknown.json();
    for (const place of [
      "private",
      "teamBeta",
      "issueBeta",
      "projectBeta",
    ] as const) {
      const response = await ask(world, limited, place);
      expect({ place, status: response.status }).toEqual({
        place,
        status: 404,
      });
      expect(await response.json()).toEqual(unknownBody);
    }

    // Asking about a place they cannot enter would name who can. It answers
    // like a place that does not exist, so it does not confirm one either.
    const nowhere = await ask(world, limited, "teamAlpha", {
      projectId: "no-such-team",
    });
    expect(nowhere.status).toBe(400);
    const nowhereBody = await nowhere.json();
    for (const target of [
      { projectId: world.beta.id },
      { taskId: world.betaTask.id },
      { workProjectId: world.betaProject.id },
    ]) {
      const response = await ask(world, limited, "teamAlpha", target);
      expect({ target, status: response.status }).toEqual({
        target,
        status: 400,
      });
      expect(await response.json()).toEqual(nowhereBody);
    }
  });
});
