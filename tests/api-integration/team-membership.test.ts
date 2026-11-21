import { eq } from "drizzle-orm";
import { beforeEach, describe, expect, it, vi } from "vite-plus/test";
import db, { schema } from "../../apps/api/src/database";
import { createApp } from "../../apps/api/src/index";
import { mockAuthenticatedSession } from "./helpers/auth";
import { resetTestDatabase } from "./helpers/database";
import {
  createProjectFixture,
  createWorkspaceMember,
  type SeededMemberContext,
} from "./helpers/fixtures";

const json = (method: string, body?: unknown) => ({
  method,
  headers: { "content-type": "application/json" },
  body: body === undefined ? undefined : JSON.stringify(body),
});

type User = SeededMemberContext["user"];

async function setup() {
  const owner = await createWorkspaceMember({ role: "owner" });
  const ws = owner.workspace.id;
  const join = async () => {
    const member = await createWorkspaceMember();
    await db.insert(schema.workspaceUserTable).values({
      workspaceId: ws,
      userId: member.user.id,
      role: "member",
      joinedAt: new Date(),
    });
    return member.user;
  };
  const [alice, bob] = [await join(), await join()];
  const { project } = await createProjectFixture({
    workspaceId: ws,
    name: "Engineering",
  });
  await db.insert(schema.columnTable).values([
    { projectId: project.id, name: "Triage", slug: "triage", position: 9 },
    { projectId: project.id, name: "Canceled", slug: "canceled", position: 10 },
  ]);
  const { app } = createApp();
  const as = (user: User) => {
    mockAuthenticatedSession(user);
    return (path: string, init?: ReturnType<typeof json>) =>
      app.request(`/api${path}`, init);
  };
  const membership = (user: User, body: Record<string, boolean>) =>
    as(user)(`/project/${project.id}/membership`, json("PUT", body));
  const listed = async (user: User) => {
    const projects = await (
      await as(user)(`/project?workspaceId=${ws}`)
    ).json();
    return projects.find((p: { id: string }) => p.id === project.id);
  };
  const createTask = async (user: User, status: string, userId?: string) =>
    (
      await as(user)(
        `/task/${project.id}`,
        json("POST", {
          title: `Task ${status}`,
          description: "",
          priority: "no-priority",
          status,
          ...(userId ? { userId } : {}),
        }),
      )
    ).json();
  const inbox = (user: User) =>
    db
      .select()
      .from(schema.notificationTable)
      .where(eq(schema.notificationTable.userId, user.id));
  // Event handlers run after the response; wait for the inbox to settle.
  const types = async (user: User, expected: string[]) =>
    vi.waitFor(async () =>
      expect((await inbox(user)).map((n) => n.type).sort()).toEqual(expected),
    );
  return {
    ws,
    owner: owner.user,
    alice,
    bob,
    project,
    as,
    membership,
    listed,
    createTask,
    inbox,
    types,
  };
}

describe("API integration: team membership", () => {
  beforeEach(async () => {
    await resetTestDatabase();
  });

  it("leaves and rejoins a team without losing access to its issues", async () => {
    const {
      ws,
      owner,
      alice,
      bob,
      project,
      as,
      membership,
      listed,
      createTask,
    } = await setup();
    const task = await createTask(owner, "to-do", alice.id);
    expect((await listed(alice)).membership).toEqual({
      joined: true,
      notifyIssueAdded: false,
      notifyIssueClosed: false,
      notifyIssueTriage: false,
    });

    await membership(alice, { notifyIssueAdded: true });
    const left = await membership(alice, { joined: false });
    expect(left.status).toBe(200);
    // Leaving ends the team's notifications too.
    expect(await left.json()).toMatchObject({
      joined: false,
      notifyIssueAdded: false,
    });
    expect((await listed(alice)).membership.joined).toBe(false);
    // Only the caller's own row changed.
    expect((await listed(bob)).membership.joined).toBe(true);

    // Still a reader, still the assignee.
    const read = await as(alice)(`/task/${task.id}`);
    expect(read.status).toBe(200);
    expect((await read.json()).userId).toBe(alice.id);

    const members = await (
      await as(owner)(`/workspace/${ws}/members?projectId=${project.id}`)
    ).json();
    expect(
      members.find((m: { id: string }) => m.id === alice.id).joinedTeam,
    ).toBe(false);
    expect(
      members.find((m: { id: string }) => m.id === bob.id).joinedTeam,
    ).toBe(true);

    expect(
      (await (await membership(alice, { joined: true })).json()).joined,
    ).toBe(true);
    expect((await listed(alice)).membership.joined).toBe(true);
  });

  it("refuses a team the caller cannot access", async () => {
    const { ws, alice, membership } = await setup();
    await db.insert(schema.workspaceMemberAccessTable).values({
      workspaceId: ws,
      userId: alice.id,
      projectAccess: "selected",
    });
    expect((await membership(alice, { joined: true })).status).toBe(403);
  });

  it("notifies subscribers once per event, never the actor or the assignee twice", async () => {
    const { owner, alice, bob, as, membership, createTask, inbox, types } =
      await setup();
    await membership(alice, {
      notifyIssueAdded: true,
      notifyIssueClosed: true,
      notifyIssueTriage: true,
    });
    await membership(bob, { notifyIssueAdded: true });
    await membership(owner, { notifyIssueAdded: true });

    // Bob is the assignee: the assignment notifies him, the subscription doesn't.
    const task = await createTask(owner, "to-do", bob.id);
    await types(alice, ["team_issue_added"]);
    await types(bob, ["task_created"]);

    await createTask(owner, "triage");
    await types(alice, ["team_issue_added", "team_issue_triage"]);

    await as(owner)(`/task/status/${task.id}`, json("PUT", { status: "done" }));
    await types(alice, [
      "team_issue_added",
      "team_issue_closed",
      "team_issue_triage",
    ]);
    // Done to Canceled is not a new close; Bob hears status as the assignee
    // only, plus the unassigned triage issue through his subscription.
    await as(owner)(
      `/task/status/${task.id}`,
      json("PUT", { status: "canceled" }),
    );
    await types(bob, [
      "task_created",
      "task_status_changed",
      "task_status_changed",
      "team_issue_added",
    ]);
    const closed = (await inbox(alice)).filter(
      (n) => n.type === "team_issue_closed",
    );
    expect(closed).toHaveLength(1);
    expect(closed[0]?.eventData).toMatchObject({
      teamName: "Engineering",
      newStatus: "done",
    });
    expect(await inbox(owner)).toHaveLength(0);
  });

  it("tells subscribers when an issue moves into the team", async () => {
    const { ws, owner, alice, project, as, membership, types } = await setup();
    const { project: design } = await createProjectFixture({
      workspaceId: ws,
      name: "Design",
    });
    await membership(alice, { notifyIssueAdded: true });
    const task = await (
      await as(owner)(
        `/task/${design.id}`,
        json("POST", {
          title: "Moved",
          description: "",
          priority: "no-priority",
          status: "to-do",
        }),
      )
    ).json();
    const moved = await as(owner)(
      `/task/move/${task.id}`,
      json("PUT", { destinationProjectId: project.id }),
    );
    expect(moved.status).toBe(200);
    await types(alice, ["team_issue_added"]);
  });

  it("skips subscribers who lost access to the team", async () => {
    const { ws, owner, alice, bob, membership, createTask, inbox, types } =
      await setup();
    await membership(alice, { notifyIssueAdded: true });
    await membership(bob, { notifyIssueAdded: true });
    await db.insert(schema.workspaceMemberAccessTable).values({
      workspaceId: ws,
      userId: alice.id,
      projectAccess: "selected",
    });
    await createTask(owner, "to-do");
    await createTask(owner, "to-do");
    await types(bob, ["team_issue_added", "team_issue_added"]);
    expect(await inbox(alice)).toHaveLength(0);
  });
});
