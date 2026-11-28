import { eq } from "drizzle-orm";
import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "vite-plus/test";
import * as Y from "../../apps/api/node_modules/yjs";
import db, { schema } from "../../apps/api/src/database";
import { resetTestDatabase } from "./helpers/database";
import {
  buildDocumentWorld,
  type DocumentWorld,
  json,
} from "./helpers/document-access/build-document-world";

// Stands in for the owner's approval; any value turns co-editing on.
const KEY = "DOCUMENT_COEDITING_KEY";

type Collab = {
  state: string | null;
  contentHash: string;
  content: string | null;
};
type Saved = { content: string; contentHash: string };

const encode = (bytes: Uint8Array) => Buffer.from(bytes).toString("base64");
const decode = (text: string) => new Uint8Array(Buffer.from(text, "base64"));

// What the web editor keeps: paragraphs in the "default" fragment.
function paragraphDoc(text: string) {
  const doc = new Y.Doc();
  const paragraph = new Y.XmlElement("paragraph");
  paragraph.insert(0, [new Y.XmlText(text)]);
  doc.getXmlFragment("default").insert(0, [paragraph]);
  return doc;
}
const firstText = (doc: Y.Doc) =>
  (doc.getXmlFragment("default").get(0) as Y.XmlElement).get(0) as Y.XmlText;
const paragraphs = (doc: Y.Doc) =>
  doc
    .getXmlFragment("default")
    .toArray()
    .map((node) => (node as Y.XmlElement).toString());

function client(world: DocumentWorld, id = world.docs.workspace) {
  const path = `/document/workspace/${world.ws}/${id}`;
  return (user: DocumentWorld["owner"]) => {
    const call = world.as(user);
    return {
      open: () => call(path),
      collab: () => call(`${path}/collab`),
      seed: (doc: Y.Doc, baseHash: string) =>
        call(
          `${path}/collab/seed`,
          json("POST", {
            update: encode(Y.encodeStateAsUpdate(doc)),
            baseHash,
          }),
        ),
      update: (update: Uint8Array) =>
        call(`${path}/collab/update`, json("POST", { update: encode(update) })),
      awareness: () =>
        call(
          `${path}/collab/awareness`,
          json("POST", { update: encode(new Uint8Array([0])) }),
        ),
      saveText: (content: string, baseHash?: string) =>
        call(`${path}/collab/text`, json("PUT", { content, baseHash })),
      patch: (body: unknown) => call(path, json("PATCH", body)),
    };
  };
}

async function load(world: DocumentWorld, user: DocumentWorld["owner"]) {
  const response = await client(world)(user).collab();
  expect(response.status).toBe(200);
  const body = (await response.json()) as Collab;
  const doc = new Y.Doc();
  if (body.state) Y.applyUpdate(doc, decode(body.state));
  return { doc, ...body };
}

const stateRows = () => db.select().from(schema.documentCollabStateTable);

beforeEach(async () => {
  await resetTestDatabase();
});
afterEach(() => {
  vi.unstubAllEnvs();
});

describe("API integration: co-editing while the owner has not approved it", () => {
  it("refuses every co-editing call and writes nothing", async () => {
    vi.stubEnv(KEY, "");
    const world = await buildDocumentWorld();
    const as = client(world)(world.owner);
    const opened = (await (await as.open()).json()) as Saved;

    for (const response of await Promise.all([
      as.collab(),
      as.seed(paragraphDoc("x"), opened.contentHash),
      as.update(Y.encodeStateAsUpdate(paragraphDoc("x"))),
      as.awareness(),
      as.saveText("<p>x</p>"),
    ])) {
      expect(response.status).toBe(409);
      expect(((await response.json()) as { code: string }).code).toBe(
        "COEDITING_OFF",
      );
    }
    expect(await stateRows()).toEqual([]);

    const config = (await (await world.as(world.owner)("/config")).json()) as {
      documentCoediting: boolean;
    };
    expect(config.documentCoediting).toBe(false);
  });
});

describe("API integration: co-editing a document", () => {
  beforeEach(() => {
    vi.stubEnv(KEY, "approved-for-tests");
  });

  it("says so in the public config", async () => {
    const world = await buildDocumentWorld();
    const config = (await (await world.as(world.owner)("/config")).json()) as {
      documentCoediting: boolean;
    };
    expect(config.documentCoediting).toBe(true);
  });

  it("seeds an unseeded document once, even when two people open it together", async () => {
    const world = await buildDocumentWorld();
    const first = await load(world, world.owner);
    expect(first.state).toBeNull();
    // The text to seed from comes with it.
    expect(first.content).toBe("<p>workspace</p>");

    const [a, b] = await Promise.all([
      client(world)(world.owner).seed(paragraphDoc("Plan"), first.contentHash),
      client(world)(world.open).seed(paragraphDoc("Plan"), first.contentHash),
    ]);
    expect([a.status, b.status].sort()).toEqual([200, 409]);
    const loser = a.status === 409 ? a : b;
    expect(((await loser.json()) as { code: string }).code).toBe(
      "COEDIT_SEEDED",
    );

    const reopened = await load(world, world.open);
    expect(paragraphs(reopened.doc)).toEqual(["<paragraph>Plan</paragraph>"]);
  });

  it("refuses a seed made from text that is no longer current", async () => {
    const world = await buildDocumentWorld();
    const { contentHash } = await load(world, world.owner);
    await client(world)(world.open).patch({ content: "<p>newer</p>" });
    const response = await client(world)(world.owner).seed(
      paragraphDoc("older"),
      contentHash,
    );
    expect(response.status).toBe(409);
    expect(((await response.json()) as { code: string }).code).toBe(
      "DOCUMENT_CHANGED",
    );
    expect(await stateRows()).toEqual([]);
  });

  it("merges two people typing in the same paragraph without losing text", async () => {
    const world = await buildDocumentWorld();
    const { contentHash } = await load(world, world.owner);
    expect(
      (
        await client(world)(world.owner).seed(
          paragraphDoc("Hello"),
          contentHash,
        )
      ).status,
    ).toBe(200);
    const a = await load(world, world.owner);
    const b = await load(world, world.open);

    // Both type at the same place before either hears of the other.
    const fromA: Uint8Array[] = [];
    const fromB: Uint8Array[] = [];
    a.doc.on("update", (update: Uint8Array) => fromA.push(update));
    b.doc.on("update", (update: Uint8Array) => fromB.push(update));
    firstText(a.doc).insert(5, " Ada");
    firstText(b.doc).insert(5, " Grace");
    firstText(b.doc).insert(0, ">");

    for (const update of fromA)
      expect((await client(world)(world.owner).update(update)).status).toBe(
        200,
      );
    for (const update of fromB)
      expect((await client(world)(world.open).update(update)).status).toBe(200);

    const merged = await load(world, world.limited);
    const text = firstText(merged.doc).toString();
    expect(text.startsWith(">Hello")).toBe(true);
    expect(text).toContain(" Ada");
    expect(text).toContain(" Grace");
    expect(text).toHaveLength(">Hello Ada Grace".length);
  });

  it("drops updates from people who may only view, or cannot open it", async () => {
    const world = await buildDocumentWorld();
    const shared = client(world, world.docs.sharedByName);
    const opened = (await (
      await shared(world.owner).collab()
    ).json()) as Collab;
    await shared(world.owner).seed(paragraphDoc("Shared"), opened.contentHash);
    const before = await stateRows();

    const viewer = shared(world.limited);
    // Viewing still works: they read along.
    expect((await viewer.collab()).status).toBe(200);
    expect(
      (await viewer.update(Y.encodeStateAsUpdate(paragraphDoc("mine")))).status,
    ).toBe(403);
    expect((await viewer.awareness()).status).toBe(403);
    expect((await viewer.saveText("<p>mine</p>")).status).toBe(403);
    expect(
      (await viewer.seed(paragraphDoc("mine"), opened.contentHash)).status,
    ).toBe(403);

    const hidden = client(world, world.docs.teamBeta)(world.limited);
    expect((await hidden.collab()).status).toBe(404);
    expect(
      (await hidden.update(Y.encodeStateAsUpdate(paragraphDoc("x")))).status,
    ).toBe(404);

    expect(await stateRows()).toEqual(before);
  });

  it("refuses an update that is not a Yjs update", async () => {
    const world = await buildDocumentWorld();
    const { contentHash } = await load(world, world.owner);
    await client(world)(world.owner).seed(paragraphDoc("Hi"), contentHash);
    const response = await client(world)(world.owner).update(
      new Uint8Array([255, 1, 2, 3]),
    );
    expect(response.status).toBe(400);
  });

  it("lets co-editors save the text in turn, and stops them after an outside write", async () => {
    const world = await buildDocumentWorld();
    const { contentHash } = await load(world, world.owner);
    await client(world)(world.owner).seed(paragraphDoc("Hi"), contentHash);

    // Two converged editors both save; neither is refused.
    expect(
      (await client(world)(world.owner).saveText("<p>Hi Ada</p>")).status,
    ).toBe(200);
    expect(
      (await client(world)(world.open).saveText("<p>Hi Ada Grace</p>")).status,
    ).toBe(200);
    expect((await load(world, world.owner)).state).not.toBeNull();

    // An assistant writes through the plain route: the live state is stale.
    await client(world)(world.owner).patch({ content: "<p>From MCP</p>" });
    const stale = await client(world)(world.open).saveText("<p>Hi again</p>");
    expect(stale.status).toBe(409);
    expect(((await stale.json()) as { code: string }).code).toBe(
      "DOCUMENT_CHANGED",
    );
    expect((await load(world, world.open)).state).toBeNull();

    // After review, saving over it on purpose works.
    const theirs = (await (
      await client(world)(world.open).open()
    ).json()) as Saved;
    expect(
      (
        await client(world)(world.open).saveText(
          "<p>Hi again</p>",
          theirs.contentHash,
        )
      ).status,
    ).toBe(200);
  });

  it("shows the restored text after a version is restored (restore rehearsal)", async () => {
    const world = await buildDocumentWorld();
    const owner = client(world)(world.owner);
    const original = (await (await owner.open()).json()) as Saved;
    await owner.seed(paragraphDoc("teamwide"), original.contentHash);
    // Another author, so history keeps the original as its own version.
    expect(
      (await client(world)(world.open).saveText("<p>co-edited</p>")).status,
    ).toBe(200);

    const versions = (await (
      await world.as(world.owner)(
        `/document/workspace/${world.ws}/${world.docs.workspace}/versions`,
      )
    ).json()) as Array<{ id: string; content: string }>;
    const first = versions.find(
      (version) => version.content === original.content,
    );
    if (!first) throw new Error("The first version was not kept");
    const restored = await world.as(world.owner)(
      `/document/workspace/${world.ws}/${world.docs.workspace}/versions/${first.id}/restore`,
      json("POST"),
    );
    expect(restored.status).toBe(200);

    // The live state was made from the co-edited text: it is not served.
    const reopened = await load(world, world.open);
    expect(reopened.state).toBeNull();
    const [document] = await db
      .select({ content: schema.documentTable.content })
      .from(schema.documentTable)
      .where(eq(schema.documentTable.id, world.docs.workspace));
    expect(document?.content).toBe(original.content);

    // The next opening seeds from the restored text.
    expect(
      (
        await client(world)(world.open).seed(
          paragraphDoc("restored"),
          reopened.contentHash,
        )
      ).status,
    ).toBe(200);
    expect(paragraphs((await load(world, world.owner)).doc)).toEqual([
      "<paragraph>restored</paragraph>",
    ]);
  });
});
