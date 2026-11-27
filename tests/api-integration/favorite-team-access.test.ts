import { randomUUID } from "node:crypto";
import { and, eq } from "drizzle-orm";
import { beforeEach, describe, expect, it } from "vite-plus/test";
import db from "../../apps/api/src/database";
import { favoriteTable } from "../../apps/api/src/database/schema";
import { resetTestDatabase } from "./helpers/database";
import {
  buildDocumentWorld,
  type DocumentWorld,
  json,
} from "./helpers/document-access/build-document-world";

let world: DocumentWorld;

beforeEach(async () => {
  await resetTestDatabase();
  world = await buildDocumentWorld();
  const team = world.alpha;
  const made = await world.as(world.owner)(
    `/project/${team.id}`,
    json("PUT", {
      name: team.name,
      icon: team.icon,
      slug: team.slug,
      description: team.description ?? "",
      isPublic: false,
      isPrivate: true,
    }),
  );
  expect(made.status).toBe(200);
});

const addTeam = (user: DocumentWorld["owner"], targetId: string) =>
  world.as(user)(
    `/favorite/workspace/${world.ws}`,
    json("PUT", { type: "project", targetId }),
  );
const storedFor = async (user: DocumentWorld["owner"], targetId: string) =>
  db
    .select({ id: favoriteTable.id })
    .from(favoriteTable)
    .where(
      and(
        eq(favoriteTable.userId, user.id),
        eq(favoriteTable.targetId, targetId),
      ),
    );

describe("favorite a team", () => {
  it("answers a private team the member cannot open like an unknown id", async () => {
    const unknownId = randomUUID();
    const unknown = await addTeam(world.open, unknownId);
    const hidden = await addTeam(world.open, world.alpha.id);

    expect(unknown.status).toBe(404);
    expect(hidden.status).toBe(unknown.status);
    expect(await hidden.json()).toEqual(await unknown.json());
    expect(await storedFor(world.open, world.alpha.id)).toEqual([]);
    expect(await storedFor(world.open, unknownId)).toEqual([]);
  });

  it("still stores a team the member can open", async () => {
    expect((await addTeam(world.limited, world.alpha.id)).status).toBe(200);
    expect((await addTeam(world.open, world.beta.id)).status).toBe(200);
    expect(await storedFor(world.limited, world.alpha.id)).toHaveLength(1);
    expect(await storedFor(world.open, world.beta.id)).toHaveLength(1);
  });
});
