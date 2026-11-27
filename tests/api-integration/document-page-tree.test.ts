import { beforeEach, describe, expect, it } from "vite-plus/test";
import { resetTestDatabase } from "./helpers/database";
import { createWorkspaceMember } from "./helpers/fixtures";
import {
  buildDocumentWorld,
  type DocumentWorld,
  json,
} from "./helpers/document-access/build-document-world";

type Member = DocumentWorld["owner"];
type TreeRow = { id: string; title: string; parentDocumentId: string | null };
type Detail = {
  id: string;
  scope: string;
  projectId: string | null;
  hasChildren: boolean;
  ancestors: { id: string; title: string }[];
};

describe("Page tree", () => {
  let world: DocumentWorld;
  const base = () => `/document/workspace/${world.ws}`;

  const create = async (
    user: Member,
    title: string,
    place: Record<string, string> = {},
  ) => {
    const response = await world.as(user)(
      "/document",
      json("POST", { workspaceId: world.ws, title, ...place }),
    );
    expect(response.status).toBe(200);
    return (await response.json()) as Detail;
  };
  // A page everybody in the workspace can open and edit.
  const shared = async (user: Member, title: string) => {
    const page = await create(user, title);
    const moved = await world.as(user)(
      `${base()}/${page.id}/location`,
      json("PUT", { scope: "workspace" }),
    );
    expect(moved.status).toBe(200);
    return page;
  };
  const tree = async (user: Member) => {
    const response = await world.as(user)(`${base()}/tree`);
    expect(response.status).toBe(200);
    return (await response.json()) as TreeRow[];
  };
  const parentIn = (rows: TreeRow[], id: string) =>
    rows.find((row) => row.id === id)?.parentDocumentId;
  const detail = async (user: Member, id: string) => {
    const response = await world.as(user)(`${base()}/${id}`);
    expect(response.status).toBe(200);
    return (await response.json()) as Detail;
  };
  const move = (user: Member, id: string, parentDocumentId: string | null) =>
    world.as(user)(`${base()}/${id}/parent`, json("PUT", { parentDocumentId }));
  const remove = (user: Member, id: string, children?: string) =>
    world.as(user)(
      `${base()}/${id}${children ? `?children=${children}` : ""}`,
      json("DELETE"),
    );

  beforeEach(async () => {
    await resetTestDatabase();
    world = await buildDocumentWorld();
  });

  it("nests a child page in its parent's place and shows the path", async () => {
    const handbook = await create(world.owner, "Handbook", {
      projectId: world.alpha.id,
    });
    const onboarding = await create(world.owner, "Onboarding", {
      parentDocumentId: handbook.id,
    });
    expect(onboarding).toMatchObject({
      scope: "team",
      projectId: world.alpha.id,
      ancestors: [{ id: handbook.id, title: "Handbook" }],
    });
    expect((await detail(world.owner, handbook.id)).hasChildren).toBe(true);
    expect(parentIn(await tree(world.owner), onboarding.id)).toBe(handbook.id);

    const policies = await shared(world.owner, "Policies");
    expect((await move(world.owner, onboarding.id, policies.id)).status).toBe(
      200,
    );
    expect((await detail(world.owner, onboarding.id)).ancestors).toEqual([
      { id: policies.id, title: "Policies" },
    ]);
    expect(parentIn(await tree(world.owner), onboarding.id)).toBe(policies.id);
    expect((await move(world.owner, onboarding.id, null)).status).toBe(200);
    expect(parentIn(await tree(world.owner), onboarding.id)).toBeNull();
  });

  it("refuses to put a page under itself or its own descendant", async () => {
    const top = await shared(world.owner, "Top");
    const middle = await create(world.owner, "Middle", {
      parentDocumentId: top.id,
    });
    const bottom = await create(world.owner, "Bottom", {
      parentDocumentId: middle.id,
    });
    expect((await move(world.owner, top.id, top.id)).status).toBe(409);
    expect((await move(world.owner, top.id, bottom.id)).status).toBe(409);
    expect(parentIn(await tree(world.owner), top.id)).toBeNull();
  });

  it("hides the title of a page the reader cannot open, also as a parent", async () => {
    const root = await shared(world.owner, "Root");
    // `limited` cannot enter team Beta.
    const hidden = await create(world.owner, "Hidden plans", {
      projectId: world.beta.id,
    });
    expect((await move(world.owner, hidden.id, root.id)).status).toBe(200);
    const below = await shared(world.owner, "Below");
    expect((await move(world.owner, below.id, hidden.id)).status).toBe(200);

    const response = await world.as(world.limited)(`${base()}/tree`);
    const text = await response.text();
    expect(text).not.toContain("Hidden plans");
    expect(text).not.toContain(hidden.id);
    const rows = JSON.parse(text) as TreeRow[];
    expect(rows.some((row) => row.id === root.id)).toBe(true);
    // Shown at the top: its parent is not the reader's to see.
    expect(parentIn(rows, below.id)).toBeNull();

    const seen = await world.as(world.limited)(`${base()}/${below.id}`);
    const seenText = await seen.text();
    expect(seenText).not.toContain("Hidden plans");
    expect((JSON.parse(seenText) as Detail).ancestors).toEqual([]);
    expect((await detail(world.owner, below.id)).ancestors).toEqual([
      { id: root.id, title: "Root" },
      { id: hidden.id, title: "Hidden plans" },
    ]);
  });

  it("needs edit on the page and on its new parent", async () => {
    const mine = await shared(world.limited, "Mine");
    // Hidden from `limited`: answers like a page that does not exist.
    expect(
      (await move(world.limited, mine.id, world.docs.teamBeta)).status,
    ).toBe(404);
    const unknown = await world.as(world.limited)(
      "/document",
      json("POST", {
        workspaceId: world.ws,
        title: "Child",
        parentDocumentId: world.docs.teamBeta,
      }),
    );
    expect(unknown.status).toBe(404);
    // Shared with `limited` to read only.
    expect(
      (await move(world.limited, mine.id, world.docs.sharedByName)).status,
    ).toBe(403);
    expect(
      (await move(world.limited, world.docs.sharedByName, mine.id)).status,
    ).toBe(403);
    expect(parentIn(await tree(world.owner), mine.id)).toBeNull();
  });

  it("asks what to do with the children of a page being deleted", async () => {
    const handbook = await shared(world.owner, "Handbook");
    const onboarding = await create(world.owner, "Onboarding", {
      parentDocumentId: handbook.id,
    });
    expect((await remove(world.owner, handbook.id)).status).toBe(409);

    expect((await remove(world.owner, handbook.id, "lift")).status).toBe(200);
    const rows = await tree(world.owner);
    expect(rows.some((row) => row.id === handbook.id)).toBe(false);
    expect(parentIn(rows, onboarding.id)).toBeNull();
  });

  it("deletes the children the deleter may edit and keeps the others", async () => {
    const page = await shared(world.open, "Team notes");
    const theirs = await create(world.open, "Their child", {
      parentDocumentId: page.id,
    });
    const owners = await create(world.owner, "Owner child", {
      parentDocumentId: page.id,
    });
    // Everyone else may only read the owner's page.
    const locked = await world.as(world.owner)(
      `${base()}/${owners.id}`,
      json("PATCH", { generalAccess: "view" }),
    );
    expect(locked.status).toBe(200);

    const removed = await remove(world.open, page.id, "delete");
    expect(removed.status).toBe(200);
    // What Undo brings back with the page.
    expect(await removed.json()).toEqual({
      id: page.id,
      alsoDeleted: [theirs.id],
    });
    const rows = await tree(world.owner);
    expect(rows.some((row) => row.id === page.id)).toBe(false);
    expect(rows.some((row) => row.id === theirs.id)).toBe(false);
    expect(parentIn(rows, owners.id)).toBeNull();
  });

  it("keeps pages of another workspace out of the tree", async () => {
    const other = await createWorkspaceMember({ role: "owner" });
    const created = await world.as(other.user)(
      "/document",
      json("POST", { workspaceId: other.workspace.id, title: "Elsewhere" }),
    );
    const elsewhere = ((await created.json()) as Detail).id;

    const child = await world.as(world.owner)(
      "/document",
      json("POST", {
        workspaceId: world.ws,
        title: "Child",
        parentDocumentId: elsewhere,
      }),
    );
    expect(child.status).toBe(404);
    const mine = await shared(world.owner, "Mine");
    expect((await move(world.owner, mine.id, elsewhere)).status).toBe(404);

    // Someone outside the workspace sees neither the tree nor the pages.
    const outsider = world.as(other.user);
    expect([403, 404]).toContain((await outsider(`${base()}/tree`)).status);
    const moved = await outsider(
      `${base()}/${mine.id}/parent`,
      json("PUT", { parentDocumentId: null }),
    );
    expect([403, 404]).toContain(moved.status);
    expect((await world.as(world.owner)(`${base()}/tree`)).status).toBe(200);
  });
});
