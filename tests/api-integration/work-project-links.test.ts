import { beforeEach, describe, expect, it } from "vite-plus/test";
import db, { schema } from "../../apps/api/src/database";
import { createApp } from "../../apps/api/src/index";
import { mockAuthenticatedSession } from "./helpers/auth";
import { resetTestDatabase } from "./helpers/database";
import { createWorkspaceMember } from "./helpers/fixtures";

const json = (method: string, body?: unknown) => ({
  method,
  headers: { "content-type": "application/json" },
  body: body === undefined ? undefined : JSON.stringify(body),
});

type Link = { id: string; url: string; label: string };

async function seed() {
  const owner = await createWorkspaceMember({ role: "owner" });
  const join = async (role: string) => {
    const member = await createWorkspaceMember({ role });
    await db.insert(schema.workspaceUserTable).values({
      workspaceId: owner.workspace.id,
      userId: member.user.id,
      role,
      joinedAt: new Date(),
    });
    return member.user;
  };
  const as = (user: typeof owner.user) => {
    mockAuthenticatedSession(user);
    return createApp().app;
  };
  const project = async (name: string) =>
    (await (
      await as(owner.user).request(
        "/api/work-project",
        json("POST", { workspaceId: owner.workspace.id, name }),
      )
    ).json()) as { id: string };
  const links = async (user: typeof owner.user, projectId: string) =>
    (
      (await (
        await as(user).request(`/api/work-project/${projectId}`)
      ).json()) as { links: Link[] }
    ).links;
  return { owner: owner.user, join, as, project, links };
}

describe("API integration: work project links", () => {
  beforeEach(async () => {
    await resetTestDatabase();
  });

  it("adds links, shows them on the project in the order added and removes one", async () => {
    const { owner, join, as, project, links } = await seed();
    const member = await join("member");
    const p = await project("P");
    expect(await links(owner, p.id)).toEqual([]);

    const first = await as(member).request(
      `/api/work-project/${p.id}/link`,
      json("POST", { url: "https://example.com/spec", label: "  Spec  " }),
    );
    expect(first.status).toBe(200);
    expect(await first.json()).toMatchObject({
      url: "https://example.com/spec",
      label: "Spec",
    });
    const second = await as(member).request(
      `/api/work-project/${p.id}/link`,
      json("POST", { url: "/acme/task/ENG-1" }),
    );
    expect(second.status).toBe(200);

    const listed = await links(owner, p.id);
    expect(listed.map((link) => [link.url, link.label])).toEqual([
      ["https://example.com/spec", "Spec"],
      ["/acme/task/ENG-1", ""],
    ]);

    const removed = await as(member).request(
      `/api/work-project/${p.id}/link/${listed[0]?.id}`,
      json("DELETE"),
    );
    expect(removed.status).toBe(200);
    expect((await links(owner, p.id)).map((link) => link.url)).toEqual([
      "/acme/task/ENG-1",
    ]);
  });

  it("refuses an address that is not a web page or a path inside the app", async () => {
    const { owner, as, project, links } = await seed();
    const p = await project("P");
    for (const url of [
      "javascript:alert(1)",
      "JavaScript:alert(1)",
      "data:text/html,<script>alert(1)</script>",
      "//evil.example/path",
      "/\\evil.example/path",
      "ftp://example.com/file",
      "example.com",
      "https://",
      "   ",
    ]) {
      const response = await as(owner).request(
        `/api/work-project/${p.id}/link`,
        json("POST", { url }),
      );
      expect([url, response.status]).toEqual([url, 400]);
    }
    expect(await links(owner, p.id)).toEqual([]);
  });

  it("lets a viewer read the links but not add or remove one", async () => {
    const { owner, join, as, project, links } = await seed();
    const viewer = await join("viewer");
    const p = await project("P");
    await as(owner).request(
      `/api/work-project/${p.id}/link`,
      json("POST", { url: "https://example.com/a" }),
    );
    const [link] = await links(viewer, p.id);
    expect(link?.url).toBe("https://example.com/a");

    expect(
      (
        await as(viewer).request(
          `/api/work-project/${p.id}/link`,
          json("POST", { url: "https://example.com/b" }),
        )
      ).status,
    ).toBe(403);
    expect(
      (
        await as(viewer).request(
          `/api/work-project/${p.id}/link/${link?.id}`,
          json("DELETE"),
        )
      ).status,
    ).toBe(403);
    expect((await links(owner, p.id)).map((row) => row.url)).toEqual([
      "https://example.com/a",
    ]);
  });

  it("keeps someone outside the workspace away from the links", async () => {
    const { owner, as, project, links } = await seed();
    const outsider = (await createWorkspaceMember({ role: "owner" })).user;
    const p = await project("P");
    await as(owner).request(
      `/api/work-project/${p.id}/link`,
      json("POST", { url: "https://example.com/a" }),
    );
    const [link] = await links(owner, p.id);

    // Answered like a project that does not exist.
    const read = await as(outsider).request(`/api/work-project/${p.id}`);
    expect(read.status).toBe(404);
    expect(await read.text()).not.toContain("example.com");
    expect(
      (
        await as(outsider).request(
          `/api/work-project/${p.id}/link`,
          json("POST", { url: "https://example.com/b" }),
        )
      ).status,
    ).toBe(404);
    expect(
      (
        await as(outsider).request(
          `/api/work-project/${p.id}/link/${link?.id}`,
          json("DELETE"),
        )
      ).status,
    ).toBe(404);
    expect(await links(owner, p.id)).toHaveLength(1);
  });

  it("removes a link only through the project that holds it", async () => {
    const { owner, as, project, links } = await seed();
    const a = await project("A");
    const b = await project("B");
    await as(owner).request(
      `/api/work-project/${a.id}/link`,
      json("POST", { url: "https://example.com/a" }),
    );
    const [link] = await links(owner, a.id);

    // The caller is checked against project B, so B's path cannot reach A's link.
    expect(
      (
        await as(owner).request(
          `/api/work-project/${b.id}/link/${link?.id}`,
          json("DELETE"),
        )
      ).status,
    ).toBe(404);
    expect(await links(owner, a.id)).toHaveLength(1);
  });
});
