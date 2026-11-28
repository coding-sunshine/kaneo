import { eq, sql } from "drizzle-orm";
import { beforeEach, describe, expect, it } from "vite-plus/test";
import db, { schema } from "../../apps/api/src/database";
import { resetTestDatabase } from "./helpers/database";
import {
  buildDocumentWorld,
  json,
} from "./helpers/document-access/build-document-world";

type Saved = { content: string; contentHash: string };

async function setup() {
  const world = await buildDocumentWorld();
  const path = `/document/workspace/${world.ws}/${world.docs.workspace}`;
  const opened = (await (await world.as(world.owner)(path)).json()) as Saved;
  return { world, path, opened };
}

const stored = async (id: string) => {
  const [row] = await db
    .select({ content: schema.documentTable.content })
    .from(schema.documentTable)
    .where(eq(schema.documentTable.id, id));
  return row?.content;
};

beforeEach(async () => {
  await resetTestDatabase();
});

describe("API integration: a save made on top of an older text", () => {
  it("refuses a stale save and keeps the newer text", async () => {
    const { world, path, opened } = await setup();
    const { as, owner, open, docs } = world;

    const first = await as(owner)(
      path,
      json("PATCH", {
        content: "<p>A wrote this</p>",
        baseHash: opened.contentHash,
      }),
    );
    expect(first.status).toBe(200);
    const afterA = (await first.json()) as Saved;
    expect(afterA.contentHash).not.toBe(opened.contentHash);

    // B still holds the text both opened.
    const stale = await as(open)(
      path,
      json("PATCH", {
        content: "<p>B wrote this</p>",
        baseHash: opened.contentHash,
      }),
    );
    expect(stale.status).toBe(409);
    expect(((await stale.json()) as { code: string }).code).toBe(
      "DOCUMENT_CHANGED",
    );
    expect(await stored(docs.workspace)).toBe("<p>A wrote this</p>");

    // After reviewing, B saves on top of A's text.
    const reviewed = await as(open)(
      path,
      json("PATCH", {
        content: "<p>B wrote this</p>",
        baseHash: afterA.contentHash,
      }),
    );
    expect(reviewed.status).toBe(200);
    expect(await stored(docs.workspace)).toBe("<p>B wrote this</p>");
  });

  it("saves as before when the caller sends no base", async () => {
    const { world, path } = await setup();
    await world.as(world.owner)(path, json("PATCH", { content: "<p>A</p>" }));
    const response = await world.as(world.open)(
      path,
      json("PATCH", { content: "<p>B</p>" }),
    );
    expect(response.status).toBe(200);
    expect(await stored(world.docs.workspace)).toBe("<p>B</p>");
  });

  it("lets a title change through on an older base", async () => {
    const { world, path, opened } = await setup();
    await world.as(world.owner)(path, json("PATCH", { content: "<p>A</p>" }));
    const response = await world.as(world.open)(
      path,
      json("PATCH", { title: "Renamed", baseHash: opened.contentHash }),
    );
    expect(response.status).toBe(200);
    expect(await stored(world.docs.workspace)).toBe("<p>A</p>");
  });

  it("treats a row without a hash as the empty base", async () => {
    const { world, path } = await setup();
    // Rows written before the hash trigger existed carry none.
    await db.execute(sql`alter table document disable trigger user`);
    await db
      .update(schema.documentTable)
      .set({ contentHash: null })
      .where(eq(schema.documentTable.id, world.docs.workspace));
    await db.execute(sql`alter table document enable trigger user`);

    const response = await world.as(world.open)(
      path,
      json("PATCH", { content: "<p>B</p>", baseHash: "" }),
    );
    expect(response.status).toBe(200);
  });

  it("still asks for edit access before it compares", async () => {
    const { world } = await setup();
    const shared = `/document/workspace/${world.ws}/${world.docs.sharedByName}`;
    const response = await world.as(world.limited)(
      shared,
      json("PATCH", { content: "<p>no</p>", baseHash: "x" }),
    );
    expect(response.status).toBe(403);
  });
});
