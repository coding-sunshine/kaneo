import { eq } from "drizzle-orm";
import { beforeEach, describe, expect, it } from "vite-plus/test";
import { runDailyBriefs } from "../../apps/api/src/daily-brief/run-daily-briefs";
import db, { schema } from "../../apps/api/src/database";
import {
  chatChannelMemberTable,
  chatChannelTable,
  chatMessageTable,
  dailyBriefTable,
  userProfileTable,
} from "../../apps/api/src/database/schema";
import { createApp } from "../../apps/api/src/index";
import { mockAuthenticatedSession } from "./helpers/auth";
import { resetTestDatabase } from "./helpers/database";
import {
  createProjectFixture,
  createWorkspaceMember,
} from "./helpers/fixtures";
import { restrictToProjects } from "./helpers/project-access/restrict-to-projects";

type User = typeof schema.userTable.$inferSelect;
const { app } = createApp();

// The run is at 08:30 UTC; every user here has no time zone, so UTC.
const MORNING = new Date("2026-03-10T08:30:00.000Z");
const hoursBefore = (hours: number) =>
  new Date(MORNING.getTime() - hours * 3_600_000);
const mention = (user: User, text: string) =>
  `<kaneo-mention id="${user.id}">@${user.name}</kaneo-mention> ${text}`;

const call = (user: User, path: string, method = "GET", body?: object) => {
  mockAuthenticatedSession(user);
  return app.request(`/api/daily-brief${path}`, {
    method,
    ...(body
      ? {
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        }
      : {}),
  });
};

async function setup() {
  const a = await createWorkspaceMember({ role: "owner", userName: "Avery" });
  const ws = a.workspace.id;
  const b = (await createWorkspaceMember({ userName: "Blair" })).user;
  await db.insert(schema.workspaceUserTable).values({
    workspaceId: ws,
    userId: b.id,
    role: "member",
    joinedAt: new Date(),
  });
  const channel = async (name: string, extra = {}) => {
    const [row] = await db
      .insert(chatChannelTable)
      .values({ workspaceId: ws, name, createdBy: a.user.id, ...extra })
      .returning();
    return row;
  };
  const x = await channel("x");
  const y = await channel("y");
  const dm = await channel("dm", {
    isPrivate: true,
    directKey: [a.user.id, b.id].sort().join(":"),
  });
  const secret = await channel("secret", { isPrivate: true });
  for (const c of [x, y, dm, secret])
    await db
      .insert(chatChannelMemberTable)
      .values({ channelId: c.id, userId: a.user.id });
  for (const c of [x, y, dm])
    await db
      .insert(chatChannelMemberTable)
      .values({ channelId: c.id, userId: b.id });
  const post = async (channelId: string, body: string, at = hoursBefore(2)) => {
    const [row] = await db
      .insert(chatMessageTable)
      .values({ channelId, body, userId: a.user.id, createdAt: at })
      .returning();
    return row;
  };
  const project = await createProjectFixture({ workspaceId: ws, slug: "web" });
  let number = 0;
  const task = async (title: string, extra = {}) => {
    number += 1;
    const [row] = await db
      .insert(schema.taskTable)
      .values({
        projectId: project.project.id,
        title,
        status: "to-do",
        columnId: project.columns.todo.id,
        number,
        userId: b.id,
        ...extra,
      })
      .returning();
    return row;
  };
  return { a: a.user, b, ws, x, y, dm, secret, post, task, project };
}

const enable = (user: User, ws: string, channelIds: string[]) =>
  call(user, `/workspace/${ws}/preference`, "PUT", {
    enabled: true,
    channelIds,
  });

describe("API integration: daily brief", () => {
  beforeEach(async () => {
    await resetTestDatabase();
  });

  it("puts a morning brief in my Inbox from my chosen channels only, with links", async () => {
    const { a, b, ws, x, y, dm, post, task } = await setup();
    const put = await enable(b, ws, [x.id]);
    expect(put.status, await put.clone().text()).toBe(200);
    expect(await (await call(b, `/workspace/${ws}/preference`)).json()).toEqual(
      { enabled: true, channelIds: [x.id] },
    );

    const inX = await post(x.id, mention(b, "can you review the launch plan"));
    await post(x.id, "No mention here");
    await post(x.id, mention(b, "too old"), hoursBefore(30));
    await post(y.id, mention(b, "salary talk in y"));
    await post(dm.id, mention(b, "private dm words"));
    const due = await task("Ship the release notes", {
      dueDate: new Date("2026-03-10T00:00:00.000Z"),
    });
    await task("Due tomorrow", {
      dueDate: new Date("2026-03-11T00:00:00.000Z"),
    });
    const moved = await task("Checkout flow");
    await db.insert(schema.activityTable).values({
      taskId: moved.id,
      type: "status_changed",
      userId: a.id,
      eventData: { oldStatus: "to-do", newStatus: "in-progress" },
      createdAt: hoursBefore(3),
    });

    expect(await runDailyBriefs(hoursBefore(2))).toEqual({ sent: 0 });
    expect(await runDailyBriefs(MORNING)).toEqual({ sent: 1 });
    // One brief a day.
    expect(
      await runDailyBriefs(new Date(MORNING.getTime() + 3_600_000)),
    ).toEqual({ sent: 0 });

    const notifications = await db
      .select()
      .from(schema.notificationTable)
      .where(eq(schema.notificationTable.userId, b.id));
    expect(notifications).toHaveLength(1);
    const [note] = notifications;
    expect(note).toMatchObject({
      type: "daily_brief",
      resourceType: "workspace",
      resourceId: ws,
    });
    const briefId =
      (note?.eventData as { briefId: string } | undefined)?.briefId ?? "";

    const res = await call(b, `/workspace/${ws}/briefs/${briefId}`);
    expect(res.status, await res.clone().text()).toBe(200);
    const brief = await res.json();
    expect(brief.dueToday).toEqual([
      expect.objectContaining({
        id: due.id,
        title: "Ship the release notes",
        ticket: `WEB-${due.number}`,
      }),
    ]);
    expect(brief.mentions).toEqual([
      expect.objectContaining({
        messageId: inX.id,
        channelId: x.id,
        channelName: "x",
      }),
    ]);
    expect(brief.mentions[0].preview).toContain("review the launch plan");
    expect(brief.moved).toEqual([
      expect.objectContaining({
        id: moved.id,
        ticket: `WEB-${moved.number}`,
        status: "in-progress",
      }),
    ]);
    const text = JSON.stringify(brief);
    expect(text).not.toContain("salary talk");
    expect(text).not.toContain("private dm words");
    // It names and ranks no person.
    expect(text).not.toContain("Avery");
    expect(text).not.toContain(a.id);
  });

  it("leaves out a chosen channel once its AI is turned off", async () => {
    const { b, ws, x, post } = await setup();
    await enable(b, ws, [x.id]);
    await post(x.id, mention(b, "words from a no-AI channel"));
    await db
      .update(chatChannelTable)
      .set({ aiDisabled: true })
      .where(eq(chatChannelTable.id, x.id));
    await runDailyBriefs(MORNING);
    const [note] = await db.select().from(schema.notificationTable);
    const briefId =
      (note?.eventData as { briefId: string } | undefined)?.briefId ?? "";
    const brief = await (
      await call(b, `/workspace/${ws}/briefs/${briefId}`)
    ).json();
    expect(brief.mentions).toEqual([]);
    expect(JSON.stringify(brief)).not.toContain("no-AI channel");
  });

  it("drops lines I can no longer open when I read the brief later", async () => {
    const { a, b, ws, post, task, project } = await setup();
    const [closed] = await db
      .insert(chatChannelTable)
      .values({
        workspaceId: ws,
        name: "closed",
        isPrivate: true,
        createdBy: a.id,
      })
      .returning();
    await db.insert(chatChannelMemberTable).values([
      { channelId: closed.id, userId: a.id },
      { channelId: closed.id, userId: b.id },
    ]);
    await enable(b, ws, [closed.id]);
    await post(closed.id, mention(b, "words from the closed channel"));
    const due = await task("Due in a team I lose", {
      dueDate: new Date("2026-03-10T00:00:00.000Z"),
    });
    await runDailyBriefs(MORNING);
    const [note] = await db.select().from(schema.notificationTable);
    const briefId =
      (note?.eventData as { briefId: string } | undefined)?.briefId ?? "";
    const before = await (
      await call(b, `/workspace/${ws}/briefs/${briefId}`)
    ).json();
    expect(before.mentions).toHaveLength(1);
    expect(before.dueToday.map((t: { id: string }) => t.id)).toEqual([due.id]);

    await db
      .delete(chatChannelMemberTable)
      .where(eq(chatChannelMemberTable.userId, b.id));
    const other = await createProjectFixture({ workspaceId: ws });
    await restrictToProjects(ws, b.id, [other.project.id]);
    const after = await (
      await call(b, `/workspace/${ws}/briefs/${briefId}`)
    ).json();
    expect(after.mentions).toEqual([]);
    expect(after.dueToday).toEqual([]);
    expect(JSON.stringify(after)).not.toContain("closed channel");
    expect(project).toBeTruthy();
  });

  it("no other user can open my brief", async () => {
    const { a, b, ws, x } = await setup();
    await enable(b, ws, [x.id]);
    await runDailyBriefs(MORNING);
    const [note] = await db.select().from(schema.notificationTable);
    const briefId =
      (note?.eventData as { briefId: string } | undefined)?.briefId ?? "";
    expect((await call(a, `/workspace/${ws}/briefs/${briefId}`)).status).toBe(
      404,
    );
    const stranger = await createWorkspaceMember({ role: "owner" });
    expect(
      (await call(stranger.user, `/workspace/${ws}/briefs/${briefId}`)).status,
    ).toBe(404);
    expect(
      (
        await call(
          stranger.user,
          `/workspace/${stranger.workspace.id}/briefs/${briefId}`,
        )
      ).status,
    ).toBe(404);
  });

  it("refuses a channel I cannot read and direct messages, and sends nothing when off", async () => {
    const { b, ws, dm, secret, x } = await setup();
    expect((await enable(b, ws, [secret.id])).status).toBe(404);
    expect((await enable(b, ws, [dm.id])).status).toBe(400);
    const stranger = await createWorkspaceMember({ role: "owner" });
    expect((await enable(stranger.user, ws, [x.id])).status).toBe(404);
    expect(await runDailyBriefs(MORNING)).toEqual({ sent: 0 });
    await enable(b, ws, [x.id]);
    await call(b, `/workspace/${ws}/preference`, "PUT", {
      enabled: false,
      channelIds: [x.id],
    });
    expect(await runDailyBriefs(MORNING)).toEqual({ sent: 0 });
  });

  it("refuses a channel marked no AI", async () => {
    const { b, ws, x, y } = await setup();
    await db
      .update(chatChannelTable)
      .set({ aiDisabled: true })
      .where(eq(chatChannelTable.id, y.id));
    const res = await enable(b, ws, [x.id, y.id]);
    expect(res.status, await res.clone().text()).toBe(400);
    expect(await (await call(b, `/workspace/${ws}/preference`)).json()).toEqual(
      { enabled: false, channelIds: [] },
    );
  });

  it("drops a chosen channel I was removed from", async () => {
    const { a, b, ws, x, post } = await setup();
    const [closed] = await db
      .insert(chatChannelTable)
      .values({
        workspaceId: ws,
        name: "closed",
        isPrivate: true,
        createdBy: a.id,
      })
      .returning();
    await db.insert(chatChannelMemberTable).values([
      { channelId: closed.id, userId: a.id },
      { channelId: closed.id, userId: b.id },
    ]);
    expect((await enable(b, ws, [x.id, closed.id])).status).toBe(200);
    await db
      .delete(chatChannelMemberTable)
      .where(eq(chatChannelMemberTable.userId, b.id));
    await post(closed.id, mention(b, "after removal words"));
    await runDailyBriefs(MORNING);
    const [note] = await db.select().from(schema.notificationTable);
    const briefId =
      (note?.eventData as { briefId: string } | undefined)?.briefId ?? "";
    const brief = await (
      await call(b, `/workspace/${ws}/briefs/${briefId}`)
    ).json();
    expect(JSON.stringify(brief)).not.toContain("after removal words");
  });

  it("reads due today in my own time zone", async () => {
    const { b, ws, x, task } = await setup();
    await db
      .insert(userProfileTable)
      .values({ userId: b.id, timeZone: "Asia/Kolkata" });
    await enable(b, ws, [x.id]);
    // The picker stores local midnight: 10 March in Kolkata.
    const due = await task("Local due", {
      dueDate: new Date("2026-03-09T18:30:00.000Z"),
    });
    await task("Local tomorrow", {
      dueDate: new Date("2026-03-10T18:30:00.000Z"),
    });
    // 08:30 UTC is 14:00 in Kolkata.
    expect(await runDailyBriefs(MORNING)).toEqual({ sent: 1 });
    const [brief] = await db.select().from(dailyBriefTable);
    expect(brief?.day).toBe("2026-03-10");
    expect(brief?.content.dueToday.map((t) => t.id)).toEqual([due.id]);
  });

  it("leaves out tickets in a team I cannot open", async () => {
    const { a, b, ws, x, task } = await setup();
    const hidden = await createProjectFixture({ workspaceId: ws });
    const open = await createProjectFixture({ workspaceId: ws });
    await restrictToProjects(ws, b.id, [open.project.id]);
    const [secret] = await db
      .insert(schema.taskTable)
      .values({
        projectId: hidden.project.id,
        title: "Hidden due",
        status: "to-do",
        columnId: hidden.columns.todo.id,
        number: 1,
        userId: b.id,
        dueDate: new Date("2026-03-10T00:00:00.000Z"),
      })
      .returning();
    await db.insert(schema.activityTable).values({
      taskId: secret.id,
      type: "status_changed",
      userId: a.id,
      eventData: { oldStatus: "to-do", newStatus: "done" },
      createdAt: hoursBefore(1),
    });
    await enable(b, ws, [x.id]);
    await runDailyBriefs(MORNING);
    const [note] = await db.select().from(schema.notificationTable);
    const briefId =
      (note?.eventData as { briefId: string } | undefined)?.briefId ?? "";
    const brief = await (
      await call(b, `/workspace/${ws}/briefs/${briefId}`)
    ).json();
    expect(JSON.stringify(brief)).not.toContain("Hidden due");
    expect(brief.dueToday).toEqual([]);
    expect(brief.moved).toEqual([]);
    expect(task).toBeTruthy();
  });
});
