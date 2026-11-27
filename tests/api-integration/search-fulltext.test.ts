import { beforeEach, describe, expect, it } from "vite-plus/test";
import db, { schema } from "../../apps/api/src/database";
import { topicTable } from "../../apps/api/src/database/schema";
import { createApp } from "../../apps/api/src/index";
import { mockAuthenticatedSession } from "./helpers/auth";
import { resetTestDatabase } from "./helpers/database";
import {
  createProjectFixture,
  createWorkspaceMember,
} from "./helpers/fixtures";

async function setup() {
  const member = await createWorkspaceMember();
  const { project } = await createProjectFixture({
    workspaceId: member.workspace.id,
    slug: "SRC",
  });
  const { app } = createApp();
  const search = async (
    q: string,
    type = "tasks",
    user = member.user,
    workspaceId = member.workspace.id,
  ) => {
    mockAuthenticatedSession(user);
    const res = await app.request(
      `/api/search?${new URLSearchParams({ q, type, workspaceId })}`,
    );
    expect(res.status).toBe(200);
    return (await res.json()).results as {
      id: string;
      title: string;
      taskId?: string;
      taskNumber?: number;
    }[];
  };
  const task = async (title: string, number: number, description?: string) =>
    (
      await db
        .insert(schema.taskTable)
        .values({ projectId: project.id, title, number, description })
        .returning()
    )[0];
  return { member, project, search, task };
}

describe("full-text search", () => {
  beforeEach(async () => {
    await resetTestDatabase();
  });

  it("ranks exact title, then all words in any order, then prefix", async () => {
    const { search, task } = await setup();
    const prefix = await task("Deployment pipeline cleanup", 1);
    const words = await task("Fix the broken deploy script", 2);
    const exact = await task("deploy script", 3);
    const body = await task("Unrelated", 4, "<p>the script to deploy</p>");
    await task("Nothing here", 5);

    const results = await search("deploy script");
    expect(results.map((r) => r.id)).toEqual([exact.id, words.id, body.id]);
    expect(results.map((r) => r.id)).not.toContain(prefix.id);

    // "deplo scr" only matches as prefixes; whole-word matches still win.
    const partial = await search("deplo scr");
    expect(partial).toHaveLength(3);
    expect(partial.map((r) => r.id)).toEqual(
      expect.arrayContaining([exact.id, words.id, body.id]),
    );
    expect((await search("deploy")).map((r) => r.id)).toContain(prefix.id);
    expect((await search("deploy"))[0].id).not.toBe(prefix.id);
  });

  it("puts an identifier match first and keeps substring matching for short queries", async () => {
    const { search, task } = await setup();
    const t = await task("Anything", 12);
    await task("SRC-12 mentioned in a title", 13);
    expect((await search("SRC-12"))[0].id).toBe(t.id);
    await task("xy marks", 14);
    expect((await search("xy")).map((r) => r.title)).toContain("xy marks");
  });

  it("finds comments and documents", async () => {
    const { member, search, task } = await setup();
    const t = await task("Host task", 1);
    await db.insert(schema.activityTable).values({
      taskId: t.id,
      type: "comment",
      userId: member.user.id,
      content: "we should rollback the migration tonight",
    });
    const comments = await search("migration rollback", "comments");
    expect(comments).toHaveLength(1);
    expect(comments[0]).toMatchObject({ taskId: t.id, taskNumber: 1 });

    await db.insert(schema.documentTable).values({
      workspaceId: member.workspace.id,
      title: "Onboarding handbook",
      content: "<p>how to request laptop access</p>",
      scope: "workspace",
    });
    expect(await search("laptop access", "documents")).toHaveLength(1);
    expect(await search("onboard", "documents")).toHaveLength(1);

    const all = (await search("laptop access", "all")) as {
      title: string;
      type: string;
    }[];
    expect(all.map((r) => r.title)).toContain("Onboarding handbook");
  });

  it("names the topic of a document only for a reader who can open it", async () => {
    const { member, project, search } = await setup();
    const [teamTopic] = await db
      .insert(topicTable)
      .values({
        workspaceId: member.workspace.id,
        name: "Hiring policy",
        scope: "team",
        projectId: project.id,
      })
      .returning();
    await db.insert(schema.documentTable).values({
      workspaceId: member.workspace.id,
      title: "walrus handbook",
      scope: "workspace",
      topicId: teamTopic.id,
      status: "current",
    });
    const mine = (await search("walrus", "documents")) as {
      status?: string;
      topicName?: string;
    }[];
    expect(mine).toMatchObject([
      { status: "current", topicName: "Hiring policy" },
    ]);

    const viewer = await createWorkspaceMember();
    await db.insert(schema.workspaceUserTable).values({
      workspaceId: member.workspace.id,
      userId: viewer.user.id,
      role: "member",
      joinedAt: new Date(),
    });
    await db.insert(schema.workspaceMemberAccessTable).values({
      workspaceId: member.workspace.id,
      userId: viewer.user.id,
      projectAccess: "selected",
    });
    const theirs = (await search(
      "walrus",
      "documents",
      viewer.user,
      member.workspace.id,
    )) as { topicName?: string }[];
    expect(theirs).toHaveLength(1);
    expect(theirs[0].topicName).toBeUndefined();
  });

  it("says where a document lives, naming a team only to a reader who can enter it", async () => {
    const { member, project, search } = await setup();
    const [doc] = await db
      .insert(schema.documentTable)
      .values({
        workspaceId: member.workspace.id,
        title: "narwhal notes",
        scope: "team",
        projectId: project.id,
      })
      .returning();
    expect(await search("narwhal", "documents")).toMatchObject([
      { scope: "team", parentName: project.name },
    ]);

    // Shared by name with a member who cannot enter the team.
    const viewer = await createWorkspaceMember();
    await db.insert(schema.workspaceUserTable).values({
      workspaceId: member.workspace.id,
      userId: viewer.user.id,
      role: "member",
      joinedAt: new Date(),
    });
    await db.insert(schema.workspaceMemberAccessTable).values({
      workspaceId: member.workspace.id,
      userId: viewer.user.id,
      projectAccess: "selected",
    });
    await db
      .insert(schema.documentShareTable)
      .values({ documentId: doc.id, userId: viewer.user.id, access: "view" });
    const theirs = (await search(
      "narwhal",
      "documents",
      viewer.user,
      member.workspace.id,
    )) as { scope?: string; parentName?: string | null }[];
    expect(theirs).toHaveLength(1);
    expect(theirs[0].scope).toBe("team");
    expect(theirs[0].parentName ?? null).toBeNull();
    expect(JSON.stringify(theirs)).not.toContain(project.name);
  });

  it("never returns another workspace's rows or a team the user cannot see", async () => {
    const { member, project, search, task } = await setup();
    const other = await createWorkspaceMember();
    const { project: otherProject } = await createProjectFixture({
      workspaceId: other.workspace.id,
      slug: "OTH",
    });
    const secret = await db
      .insert(schema.taskTable)
      .values({
        projectId: otherProject.id,
        title: "zebra secret plan",
        number: 1,
      })
      .returning();
    const [otherDoc] = await db
      .insert(schema.documentTable)
      .values({
        workspaceId: other.workspace.id,
        title: "zebra handbook",
        scope: "workspace",
      })
      .returning();
    await task("zebra mine", 1);

    expect((await search("zebra")).map((r) => r.title)).toEqual(["zebra mine"]);
    expect(await search("zebra", "documents")).toEqual([]);
    // Naming the other workspace is rejected by membership, not leaked.
    mockAuthenticatedSession(member.user);
    const { app } = createApp();
    const res = await app.request(
      `/api/search?${new URLSearchParams({ q: "zebra", workspaceId: other.workspace.id })}`,
    );
    expect(res.status).not.toBe(200);
    expect(secret[0].id).not.toBe(otherDoc.id);

    // A restricted member cannot see a team they have no access to.
    const viewer = await createWorkspaceMember();
    await db.insert(schema.workspaceUserTable).values({
      workspaceId: member.workspace.id,
      userId: viewer.user.id,
      role: "member",
      joinedAt: new Date(),
    });
    await db.insert(schema.workspaceMemberAccessTable).values({
      workspaceId: member.workspace.id,
      userId: viewer.user.id,
      projectAccess: "selected",
    });
    await db.insert(schema.documentTable).values({
      workspaceId: member.workspace.id,
      title: "zebra team doc",
      scope: "team",
      projectId: project.id,
    });
    expect(
      await search("zebra", "tasks", viewer.user, member.workspace.id),
    ).toEqual([]);
    expect(
      await search("zebra", "documents", viewer.user, member.workspace.id),
    ).toEqual([]);
    expect(await search("zebra", "documents")).toHaveLength(1);
  });
});
