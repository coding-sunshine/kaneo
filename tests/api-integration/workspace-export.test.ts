import { randomUUID } from "node:crypto";
import { eq } from "drizzle-orm";
import { strFromU8, unzipSync } from "fflate";
import { beforeEach, describe, expect, it } from "vite-plus/test";
import db, { schema } from "../../apps/api/src/database";
import {
  chatChannelMemberTable,
  chatChannelTable,
  chatMessageTable,
} from "../../apps/api/src/database/schema";
import { createApp } from "../../apps/api/src/index";
import { mockAnonymousSession, mockAuthenticatedSession } from "./helpers/auth";
import { resetTestDatabase } from "./helpers/database";
import {
  createProjectFixture,
  createWorkspaceMember,
  type SeededMemberContext,
} from "./helpers/fixtures";

type User = SeededMemberContext["user"];

async function addUser(workspaceId: string, role: string, name: string) {
  const id = `user-${randomUUID()}`;
  const [user] = await db
    .insert(schema.userTable)
    .values({ id, name, email: `${id}@example.com`, emailVerified: true })
    .returning();
  await db.insert(schema.workspaceUserTable).values({
    workspaceId,
    userId: id,
    role,
    joinedAt: new Date(),
  });
  return user!;
}

async function seed() {
  const ownerContext = await createWorkspaceMember({
    role: "owner",
    userName: "Owner One",
    workspaceName: "Export Space",
  });
  const ws = ownerContext.workspace.id;
  const owner = ownerContext.user;
  const admin = await addUser(ws, "admin", "Admin Two");
  const member = await addUser(ws, "member", "Member Three");
  const viewer = await addUser(ws, "viewer", "Viewer Four");

  const { project, columns } = await createProjectFixture({
    workspaceId: ws,
    name: "Platform",
    slug: "plat",
  });
  const { project: closed } = await createProjectFixture({
    workspaceId: ws,
    name: "Closed",
    slug: "closed",
  });
  await db
    .update(schema.projectTable)
    .set({ isPrivate: true })
    .where(eq(schema.projectTable.id, closed.id));
  await db.insert(schema.taskTable).values([
    {
      projectId: project.id,
      number: 1,
      title: "Ship export",
      description: "Zip **everything**.",
      status: "to-do",
      columnId: columns.todo.id,
      userId: member.id,
    },
    {
      projectId: project.id,
      number: 2,
      title: "Archived chore",
      status: "done",
      archivedAt: new Date(),
    },
    { projectId: closed.id, number: 1, title: "Closed work", status: "to-do" },
  ]);

  await db.insert(schema.documentTable).values([
    {
      workspaceId: ws,
      title: "Handbook",
      content: "## Rules\n\n| A | B |\n| --- | --- |\n| 1 | 2 |",
      scope: "workspace",
      creatorId: owner.id,
    },
    {
      workspaceId: ws,
      title: "Admin notes",
      content: "mine",
      scope: "private",
      creatorId: admin.id,
    },
    {
      workspaceId: ws,
      title: "Member diary",
      content: "secret",
      scope: "private",
      creatorId: member.id,
    },
    {
      workspaceId: ws,
      title: "Trashed",
      content: "gone",
      scope: "workspace",
      creatorId: owner.id,
      deletedAt: new Date(),
    },
  ]);

  const [general, hidden, direct] = await db
    .insert(chatChannelTable)
    .values([
      { workspaceId: ws, name: "general", createdBy: owner.id },
      { workspaceId: ws, name: "board", isPrivate: true, createdBy: owner.id },
      {
        workspaceId: ws,
        name: "dm",
        isPrivate: true,
        directKey: `${member.id}:${owner.id}`,
        createdBy: owner.id,
      },
    ])
    .returning();
  await db.insert(chatChannelMemberTable).values([
    { channelId: hidden!.id, userId: owner.id },
    { channelId: direct!.id, userId: owner.id },
    { channelId: direct!.id, userId: member.id },
  ]);
  await db.insert(chatMessageTable).values([
    { channelId: general!.id, userId: owner.id, body: "Hello all" },
    { channelId: general!.id, userId: member.id, body: "Hi **there**" },
    { channelId: hidden!.id, userId: owner.id, body: "Board only" },
    { channelId: direct!.id, userId: member.id, body: "Just us" },
  ]);

  // Another workspace, whose rows never reach this export.
  const elsewhere = await createWorkspaceMember({ role: "admin" });
  const { project: otherProject } = await createProjectFixture({
    workspaceId: elsewhere.workspace.id,
  });
  await db.insert(schema.taskTable).values({
    projectId: otherProject.id,
    title: "Foreign task",
    status: "to-do",
  });
  await db.insert(schema.documentTable).values({
    workspaceId: elsewhere.workspace.id,
    title: "Foreign doc",
    scope: "workspace",
    creatorId: elsewhere.user.id,
  });

  const { app } = createApp();
  const as = (user: User | null, workspaceId = ws) => {
    if (user) mockAuthenticatedSession(user);
    else mockAnonymousSession();
    return app.request(`/api/workspace-export/${workspaceId}`);
  };
  return { ws, owner, admin, member, viewer, elsewhere, as };
}

async function unzip(response: Response) {
  const entries = unzipSync(new Uint8Array(await response.arrayBuffer()));
  const text = (name: string) => {
    const entry = entries[name];
    if (!entry) throw new Error(`missing ${name}`);
    return strFromU8(entry);
  };
  return {
    names: Object.keys(entries).sort(),
    text,
    json: (name: string) => JSON.parse(text(name)),
  };
}

describe("API integration: workspace export", () => {
  beforeEach(async () => {
    await resetTestDatabase();
  });

  it("zips tickets, documents, channel messages and users as JSON and Markdown", async () => {
    const { ws, admin, as } = await seed();
    const response = await as(admin);
    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toBe("application/zip");
    expect(response.headers.get("content-disposition")).toContain(
      'filename="export-space-export.zip"',
    );
    const zip = await unzip(response);

    const manifest = zip.json("manifest.json");
    expect(manifest).toMatchObject({
      workspace: { id: ws, name: "Export Space" },
      counts: { tickets: 2, documents: 2, channelMessages: 2, users: 4 },
    });

    const tickets = zip.json("tickets.json");
    expect(tickets.map((t: { key: string }) => t.key).sort()).toEqual([
      "PLAT-1",
      "PLAT-2",
    ]);
    expect(
      tickets.find((t: { key: string }) => t.key === "PLAT-1"),
    ).toMatchObject({
      title: "Ship export",
      description: "Zip **everything**.",
      team: "Platform",
      assignee: "Member Three",
    });
    expect(zip.text("tickets/plat-1.md")).toContain("# PLAT-1 Ship export");
    expect(zip.text("tickets/plat-1.md")).toContain("Zip **everything**.");

    const documents = zip.json("documents.json");
    expect(documents.map((d: { title: string }) => d.title).sort()).toEqual([
      "Admin notes",
      "Handbook",
    ]);
    const handbook = documents.find(
      (d: { title: string }) => d.title === "Handbook",
    );
    expect(zip.text(`documents/handbook-${handbook.id}.md`)).toBe(
      "# Handbook\n\n## Rules\n\n| A | B |\n| --- | --- |\n| 1 | 2 |\n",
    );

    const messages = zip.json("channel-messages.json");
    expect(messages.map((m: { body: string }) => m.body).sort()).toEqual([
      "Hello all",
      "Hi **there**",
    ]);
    expect(messages[0]).toMatchObject({ channel: "general" });
    const channelFile = zip.names.find((name) => name.startsWith("channels/"));
    expect(channelFile).toMatch(/^channels\/general-.+\.md$/);
    expect(zip.text(channelFile!)).toContain("Hello all");

    const users = zip.json("users.json");
    expect(users.map((u: { name: string }) => u.name).sort()).toEqual([
      "Admin Two",
      "Member Three",
      "Owner One",
      "Viewer Four",
    ]);
    expect(Object.keys(users[0]).sort()).toEqual([
      "email",
      "id",
      "joinedAt",
      "name",
      "role",
    ]);
    expect(zip.text("users.md")).toContain("Viewer Four");

    const all = zip.names.map((name) => zip.text(name)).join("\n");
    for (const hidden of [
      "Closed work",
      "Member diary",
      "Trashed",
      "Board only",
      "Just us",
      "Foreign task",
      "Foreign doc",
    ]) {
      expect(all).not.toContain(hidden);
    }
  });

  it("lets the owner export what the owner can open", async () => {
    const { owner, as } = await seed();
    const response = await as(owner);
    expect(response.status).toBe(200);
    const { counts } = (await unzip(response)).json("manifest.json");
    // The private team, the private board and the direct message are open
    // to the owner; the admin's private document is not.
    expect(counts).toEqual({
      tickets: 3,
      documents: 1,
      channelMessages: 4,
      users: 4,
    });
  });

  it("refuses members, viewers, outsiders and signed-out callers", async () => {
    const { member, viewer, elsewhere, as } = await seed();
    expect((await as(member)).status).toBe(403);
    expect((await as(viewer)).status).toBe(403);
    expect((await as(elsewhere.user)).status).toBe(404);
    expect((await as(null)).status).toBe(401);
  });
});
