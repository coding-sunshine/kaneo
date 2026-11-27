import { beforeEach, describe, expect, it } from "vite-plus/test";
import { resetTestDatabase } from "./helpers/database";
import {
  buildDocumentWorld,
  type DocumentWorld,
  json,
} from "./helpers/document-access/build-document-world";
import { createWorkspaceMember } from "./helpers/fixtures";
import { restrictToProjects } from "./helpers/project-access/restrict-to-projects";

type Template = {
  id: string;
  name: string;
  title: string;
  content: string;
  creatorId: string | null;
};
type Member = DocumentWorld["owner"];

const base = (world: DocumentWorld) =>
  `/document-template/workspace/${world.ws}`;

const list = async (world: DocumentWorld, user: Member) => {
  const response = await world.as(user)(base(world));
  expect(response.status).toBe(200);
  return (await response.json()) as Template[];
};

const save = (
  world: DocumentWorld,
  user: Member,
  documentId: string,
  name?: string,
) => world.as(user)(base(world), json("POST", { documentId, name }));

describe("Document templates", () => {
  let world: DocumentWorld;

  beforeEach(async () => {
    await resetTestDatabase();
    world = await buildDocumentWorld();
  });

  it("saves a page open to the whole workspace as a template every member lists", async () => {
    const saved = await save(world, world.open, world.docs.workspace, "Retro");
    expect(saved.status).toBe(200);
    const template = (await saved.json()) as Template;
    expect(template).toMatchObject({
      name: "Retro",
      content: "<p>workspace</p>",
      creatorId: world.open.id,
    });

    for (const member of [world.owner, world.limited, world.open]) {
      expect((await list(world, member)).map((row) => row.id)).toEqual([
        template.id,
      ]);
    }
  });

  it("names the template after the page when no name is given", async () => {
    const saved = await save(world, world.owner, world.docs.workspace);
    expect(saved.status).toBe(200);
    expect(((await saved.json()) as Template).name).toBe("leakdoc workspace");
  });

  it("refuses a page not open to the whole workspace", async () => {
    // Team, issue and project pages, a private draft, and a team page shared
    // by name: each would show its text to members who cannot open it.
    for (const place of [
      "teamAlpha",
      "teamBeta",
      "issueBeta",
      "project",
      "projectBeta",
      "private",
      "sharedInBeta",
    ] as const) {
      const response = await save(world, world.owner, world.docs[place]);
      expect(response.status, place).toBe(403);
    }
    expect(await list(world, world.limited)).toEqual([]);
  });

  it("refuses a private team page also to a member of that team", async () => {
    // `limited` may enter team Alpha; the rest of the workspace may not.
    await restrictToProjects(world.ws, world.open.id, [world.beta.id]);
    const response = await save(world, world.limited, world.docs.teamAlpha);
    expect(response.status).toBe(403);
    expect(await list(world, world.open)).toEqual([]);
  });

  it("needs a page the person can open", async () => {
    const hidden = await save(world, world.limited, world.docs.teamBeta);
    expect(hidden.status).toBe(404);
    const unknown = await save(world, world.owner, "no-such-document");
    expect(unknown.status).toBe(404);
    expect(await list(world, world.owner)).toEqual([]);
  });

  it("does not take a page from another workspace", async () => {
    const other = await createWorkspaceMember({ role: "owner" });
    const response = await world.as(other.user)(
      `/document-template/workspace/${other.workspace.id}`,
      json("POST", { documentId: world.docs.workspace }),
    );
    expect(response.status).toBe(404);
  });

  it("is not listed to someone outside the workspace", async () => {
    await save(world, world.owner, world.docs.workspace);
    const other = await createWorkspaceMember({ role: "owner" });
    const response = await world.as(other.user)(base(world));
    expect([403, 404]).toContain(response.status);
  });

  it("keeps the template when the page or a document made from it changes", async () => {
    const saved = await save(world, world.owner, world.docs.workspace);
    const template = (await saved.json()) as Template;

    const created = await world.as(world.open)(
      "/document",
      json("POST", {
        workspaceId: world.ws,
        title: template.title,
        content: template.content,
      }),
    );
    expect(created.status).toBe(200);
    const made = ((await created.json()) as { id: string }).id;
    for (const id of [made, world.docs.workspace]) {
      const author = id === made ? world.open : world.owner;
      const edited = await world.as(author)(
        `/document/workspace/${world.ws}/${id}`,
        json("PATCH", { content: "<p>changed</p>" }),
      );
      expect(edited.status).toBe(200);
    }

    const [kept] = await list(world, world.owner);
    expect(kept?.content).toBe("<p>workspace</p>");
  });

  it("is deleted by its creator or a workspace owner only", async () => {
    const saved = await save(world, world.open, world.docs.workspace);
    const template = (await saved.json()) as Template;
    const remove = (user: Member) =>
      world.as(user)(`${base(world)}/${template.id}`, json("DELETE"));

    expect((await remove(world.limited)).status).toBe(403);
    expect((await remove(world.owner)).status).toBe(200);
    expect(await list(world, world.open)).toEqual([]);

    const again = await save(world, world.open, world.docs.workspace);
    const second = (await again.json()) as Template;
    const own = await world.as(world.open)(
      `${base(world)}/${second.id}`,
      json("DELETE"),
    );
    expect(own.status).toBe(200);
  });

  it("answers 404 for a template of another workspace", async () => {
    const saved = await save(world, world.owner, world.docs.workspace);
    const template = (await saved.json()) as Template;
    const other = await createWorkspaceMember({ role: "owner" });
    const response = await world.as(other.user)(
      `/document-template/workspace/${other.workspace.id}/${template.id}`,
      json("DELETE"),
    );
    expect(response.status).toBe(404);
    expect(await list(world, world.owner)).toHaveLength(1);
  });
});
