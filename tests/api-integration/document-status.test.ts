import { createHash } from "node:crypto";
import { eq, sql } from "drizzle-orm";
import { beforeEach, describe, expect, it } from "vite-plus/test";
import db, { schema } from "../../apps/api/src/database";
import { resetTestDatabase } from "./helpers/database";
import {
  buildDocumentWorld,
  type DocumentPlace,
  type DocumentWorld,
  json,
} from "./helpers/document-access/build-document-world";

type Labels = {
  id: string;
  kind: string;
  status: string;
  sourceClient: string | null;
  contentHash?: string;
};

const hash = (text: string) =>
  createHash("sha256").update(text, "utf8").digest("hex");
const one = (world: DocumentWorld, place: DocumentPlace) =>
  `/document/workspace/${world.ws}/${world.docs[place]}`;
const stored = async (id: string) => {
  const [row] = await db
    .select({
      kind: schema.documentTable.kind,
      status: schema.documentTable.status,
      sourceClient: schema.documentTable.sourceClient,
      contentHash: schema.documentTable.contentHash,
    })
    .from(schema.documentTable)
    .where(eq(schema.documentTable.id, id));
  return row;
};
// The name of the constraint that refused a write, or null when it went in.
const refusedBy = async (write: PromiseLike<unknown>) => {
  try {
    await write;
    return null;
  } catch (error) {
    const { cause, constraint } = error as {
      cause?: { constraint?: string };
      constraint?: string;
    };
    return cause?.constraint ?? constraint ?? String(error);
  }
};

// Text a careless hash gets wrong: two-byte and three-byte characters, a
// backslash and a quote.
const TEXT = "<p>Zürich café, 日本語, C:\\temp, it's</p>";
const LATER = "<p>Später: naïve \\n 東京</p>";

describe("API integration: document kind, status and content hash", () => {
  beforeEach(async () => {
    await resetTestDatabase();
  });

  it("starts every document as an unsorted draft", async () => {
    const world = await buildDocumentWorld();
    const response = await world.as(world.owner)(one(world, "teamAlpha"));
    expect((await response.json()) as Labels).toMatchObject({
      kind: "unsorted",
      status: "draft",
      sourceClient: null,
      contentHash: hash("<p>teamAlpha</p>"),
    });

    const list = await world.as(world.owner)(`/document/workspace/${world.ws}`);
    const rows = (await list.json()) as Labels[];
    expect(rows.length).toBeGreaterThan(0);
    for (const row of rows) {
      expect(row).toMatchObject({
        kind: "unsorted",
        status: "draft",
        sourceClient: null,
      });
    }
  });

  it("keeps the hash of the text, whoever writes it", async () => {
    const world = await buildDocumentWorld();
    const { owner, ws } = world;
    const created = (await (
      await world.as(owner)(
        "/document",
        json("POST", { workspaceId: ws, title: "Notes", content: TEXT }),
      )
    ).json()) as Labels;
    expect(created.contentHash).toBe(hash(TEXT));
    const path = `/document/workspace/${ws}/${created.id}`;

    const edited = (await (
      await world.as(owner)(path, json("PATCH", { content: LATER }))
    ).json()) as Labels;
    expect(edited.contentHash).toBe(hash(LATER));

    // One author's quick edits fold into one version, so the first text is
    // put back into the history by hand.
    const [first] = await db
      .insert(schema.documentVersionTable)
      .values({ documentId: created.id, title: "Notes", content: TEXT })
      .returning({ id: schema.documentVersionTable.id });
    const restored = await world.as(owner)(
      `${path}/versions/${first?.id}/restore`,
      json("POST"),
    );
    expect(restored.status).toBe(200);
    expect(((await restored.json()) as Labels).contentHash).toBe(hash(TEXT));

    // Imports write rows by SQL and know nothing of the column.
    await db.execute(
      sql`INSERT INTO document (id, workspace_id, content) VALUES ('by-sql', ${ws}, ${TEXT})`,
    );
    expect((await stored("by-sql"))?.contentHash).toBe(hash(TEXT));
    await db.execute(
      sql`UPDATE document SET content = ${LATER} WHERE id = 'by-sql'`,
    );
    expect((await stored("by-sql"))?.contentHash).toBe(hash(LATER));
    await db.execute(
      sql`UPDATE document SET content_hash = 'forged' WHERE id = 'by-sql'`,
    );
    expect((await stored("by-sql"))?.contentHash).toBe(hash(LATER));
    await db.execute(
      sql`INSERT INTO document (id, workspace_id) VALUES ('empty', ${ws})`,
    );
    expect((await stored("empty"))?.contentHash).toBe(hash(""));
  });

  it("lets an editor set the kind, and nobody set the status by editing", async () => {
    const world = await buildDocumentWorld();
    const { owner, limited, ws } = world;
    const patch = (
      user: typeof owner,
      place: DocumentPlace,
      body: Record<string, string>,
    ) => world.as(user)(one(world, place), json("PATCH", body));

    const sorted = await patch(owner, "workspace", { kind: "brainstorm" });
    expect(sorted.status).toBe(200);
    expect(((await sorted.json()) as Labels).kind).toBe("brainstorm");
    const rows = (await (
      await world.as(owner)(`/document/workspace/${ws}`)
    ).json()) as Labels[];
    expect(rows.find((row) => row.id === world.docs.workspace)?.kind).toBe(
      "brainstorm",
    );

    expect((await patch(owner, "workspace", { kind: "verdict" })).status).toBe(
      400,
    );
    // `limited` may only view this one.
    expect(
      (await patch(limited, "sharedByName", { kind: "decision" })).status,
    ).toBe(403);
    expect((await stored(world.docs.sharedByName))?.kind).toBe("unsorted");

    const forged = await patch(owner, "workspace", {
      status: "current",
      sourceClient: "claude",
      contentHash: "forged",
    });
    expect(forged.status).toBe(200);
    expect(await stored(world.docs.workspace)).toEqual({
      kind: "brainstorm",
      status: "draft",
      sourceClient: null,
      contentHash: hash("<p>workspace</p>"),
    });

    const created = (await (
      await world.as(owner)(
        "/document",
        json("POST", {
          workspaceId: ws,
          title: "Plan",
          projectId: world.alpha.id,
          status: "current",
          sourceClient: "claude",
        }),
      )
    ).json()) as Labels;
    expect(created).toMatchObject({ status: "draft", sourceClient: null });
  });

  it("refuses a current document in a private place", async () => {
    const world = await buildDocumentWorld();
    const set = (place: DocumentPlace, values: { status?: "current" }) =>
      db
        .update(schema.documentTable)
        .set(values)
        .where(eq(schema.documentTable.id, world.docs[place]));

    expect(await refusedBy(set("private", { status: "current" }))).toBe(
      "document_current_not_private",
    );
    expect(await refusedBy(set("workspace", { status: "current" }))).toBeNull();
    expect(
      await refusedBy(
        db.execute(
          sql`UPDATE document SET scope = 'private' WHERE id = ${world.docs.workspace}`,
        ),
      ),
    ).toBe("document_current_not_private");
  });

  it("says which assistant a document was saved from", async () => {
    const world = await buildDocumentWorld();
    await db
      .update(schema.documentTable)
      .set({ sourceClient: "chatgpt" })
      .where(eq(schema.documentTable.id, world.docs.teamAlpha));
    const opened = (await (
      await world.as(world.owner)(one(world, "teamAlpha"))
    ).json()) as Labels;
    expect(opened.sourceClient).toBe("chatgpt");
    const rows = (await (
      await world.as(world.owner)(
        `/document/workspace/${world.ws}?projectId=${world.alpha.id}`,
      )
    ).json()) as Labels[];
    expect(
      rows.find((row) => row.id === world.docs.teamAlpha)?.sourceClient,
    ).toBe("chatgpt");
  });
});
