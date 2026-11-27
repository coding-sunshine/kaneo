import { randomUUID } from "node:crypto";
import { beforeEach, describe, expect, it, vi } from "vite-plus/test";
import db, { schema } from "../../apps/api/src/database";
import { resetTestDatabase } from "./helpers/database";
import {
  buildDocumentWorld,
  type DocumentWorld,
} from "./helpers/document-access/build-document-world";

vi.mock("../../apps/api/src/storage/s3", async (importOriginal) => ({
  ...(await importOriginal<object>()),
  getPrivateObject: async () => ({
    body: new Uint8Array([1, 2, 3]),
    contentType: "application/pdf",
    contentLength: 3,
  }),
}));

let world: DocumentWorld;

beforeEach(async () => {
  await resetTestDatabase();
  world = await buildDocumentWorld();
});

// `limited` may enter team Alpha only, so Beta's files are out of reach.
const betaFile = async (surface: string) => {
  const [row] = await db
    .insert(schema.assetTable)
    .values({
      workspaceId: world.ws,
      projectId: world.beta.id,
      taskId: world.betaTask.id,
      objectKey: `issue/${randomUUID()}`,
      filename: "notes.pdf",
      mimeType: "application/pdf",
      size: 3,
      kind: "attachment",
      surface,
      createdBy: world.owner.id,
    })
    .returning();
  return row.id;
};

describe("GET /asset/{id} for a team the member cannot open", () => {
  it.each(["attachment", "comment", "description", "draft"])(
    "answers a %s file like an unknown id",
    async (surface) => {
      const id = await betaFile(surface);
      const ask = world.as(world.limited);
      const unknown = await ask(`/asset/${randomUUID()}`);
      const hidden = await ask(`/asset/${id}`);
      expect(unknown.status).toBe(404);
      expect(hidden.status).toBe(unknown.status);
      expect(await hidden.json()).toEqual(await unknown.json());
    },
  );

  it("still serves the file to a member who can open the team", async () => {
    const id = await betaFile("attachment");
    expect((await world.as(world.owner)(`/asset/${id}`)).status).toBe(200);
  });
});
