import { eq } from "drizzle-orm";
import { beforeEach, describe, expect, it, vi } from "vite-plus/test";
import db, { schema } from "../../apps/api/src/database";
import { settleEvents } from "../../apps/api/src/events";
import { createApp } from "../../apps/api/src/index";
import { model, reply } from "./helpers/agent-model";
import { mockAuthenticatedSession } from "./helpers/auth";
import { resetTestDatabase } from "./helpers/database";
import {
  createProjectFixture,
  createWorkspaceMember,
} from "./helpers/fixtures";
import { addWorkspaceMember } from "./helpers/project-access/add-workspace-member";
import { restrictToProjects } from "./helpers/project-access/restrict-to-projects";

vi.mock("../../apps/api/src/agent/openrouter", async (original) => ({
  ...(await original<object>()),
  createCompletion: vi.fn(async (messages: never) => {
    model.seen.push(messages);
    const next = model.queue.shift();
    if (!next) throw new Error("no scripted reply");
    return next;
  }),
}));

type User = typeof schema.userTable.$inferSelect;
type Proposal = {
  id: string;
  tool: string;
  status: string;
  selectable: boolean;
  diff: {
    field: string;
    from: string | null;
    to: string | null;
    reason?: string;
  }[];
};

const json = (method: string, body?: unknown) => ({
  method,
  headers: { "content-type": "application/json" },
  ...(body === undefined ? {} : { body: JSON.stringify(body) }),
});

describe("API integration: AI triage suggestions", () => {
  const { app } = createApp();
  let owner: User;
  let teammate: User;
  let ws: string;
  let team: Awaited<ReturnType<typeof createProjectFixture>>;
  let workProjectId: string;

  beforeEach(async () => {
    await resetTestDatabase();
    process.env.OPENROUTER_API_KEY = "test-key";
    model.queue.length = 0;
    model.seen.length = 0;
    const member = await createWorkspaceMember({ role: "owner" });
    owner = member.user;
    ws = member.workspace.id;
    team = await createProjectFixture({ workspaceId: ws });
    await db.insert(schema.columnTable).values({
      projectId: team.project.id,
      name: "Triage",
      slug: "triage",
      position: 9,
    });
    teammate = await addWorkspaceMember(ws, "member");
    await db.insert(schema.labelTable).values([
      { name: "Bug", color: "#ef4444", workspaceId: ws, taskId: null },
      { name: "Browser", color: "#3b82f6", workspaceId: ws, taskId: null },
    ]);
    const [workProject] = await db
      .insert(schema.workProjectTable)
      .values({ workspaceId: ws, name: "Web login" })
      .returning();
    workProjectId = workProject?.id ?? "";
    // AI triage is off until a workspace admin turns it on.
    expect(
      (await features(owner, { triage: true, prSummary: false })).status,
    ).toBe(200);
  });

  const as = (user: User) => {
    mockAuthenticatedSession(user);
    return app;
  };

  const features = (
    user: User,
    body?: { triage: boolean; prSummary: boolean },
  ) =>
    as(user).request(
      `/api/agent/workspace/${ws}/ai-features`,
      body ? json("PUT", body) : undefined,
    );

  const suggestion = (overrides: object = {}) =>
    reply(
      JSON.stringify({
        labels: { value: ["Bug", "Browser", "Made up"], reason: "Safari only" },
        assignee: { value: teammate.id, reason: "Owns the login page" },
        project: { value: workProjectId, reason: "Login work lives there" },
        priority: { value: "high", reason: "Nobody on Safari can sign in" },
        ...overrides,
      }),
    );

  const createTicket = async (user: User = owner, status = "triage") => {
    const res = await as(user).request(
      `/api/task/${team.project.id}`,
      json("POST", {
        title: "Login fails on Safari",
        description: "The sign-in button does nothing on Safari 18.",
        priority: "no-priority",
        status,
      }),
    );
    expect(res.status, await res.clone().text()).toBe(200);
    const { id } = (await res.json()) as { id: string };
    await settleEvents();
    return id;
  };

  const cards = async (user: User, taskId: string) => {
    const res = await as(user).request(
      `/api/agent/workspace/${ws}/tasks/${taskId}/proposals`,
    );
    return { status: res.status, body: (await res.json()) as Proposal[] };
  };

  const ticket = async (id: string) => {
    const [row] = await db
      .select()
      .from(schema.taskTable)
      .where(eq(schema.taskTable.id, id));
    const labels = await db
      .select({ name: schema.labelTable.name })
      .from(schema.labelTable)
      .where(eq(schema.labelTable.taskId, id));
    return { ...row, labels: labels.map((label) => label.name).sort() };
  };

  const settings = (user: User, body?: object) =>
    as(user).request(
      `/api/agent/workspace/${ws}/teams/${team.project.id}/triage-settings`,
      body ? json("PUT", body) : undefined,
    );

  it("puts a proposal card on a new triage ticket with labels, assignee, project and priority, each with a reason", async () => {
    model.queue.push(suggestion());
    const id = await createTicket();
    const { status, body } = await cards(owner, id);
    expect(status).toBe(200);
    expect(body).toHaveLength(1);
    const card = body[0] as Proposal;
    expect(card).toMatchObject({
      tool: "triage_task",
      status: "pending",
      selectable: true,
    });
    const byField = Object.fromEntries(card.diff.map((c) => [c.field, c]));
    expect(Object.keys(byField).sort()).toEqual([
      "assignee",
      "labels",
      "priority",
      "project",
    ]);
    // A label the workspace does not have is dropped.
    expect(byField.labels?.to).toBe("Browser, Bug");
    expect(byField.assignee?.to).toBe(teammate.name);
    expect(byField.project?.to).toBe("Web login");
    expect(byField.priority).toMatchObject({
      from: "no-priority",
      to: "high",
      reason: "Nobody on Safari can sign in",
    });
    for (const change of card.diff) expect(change.reason).toBeTruthy();
    // The ticket text reached the model as data, and nothing changed yet.
    expect(JSON.stringify(model.seen[0])).toContain("Login fails on Safari");
    const now = await ticket(id);
    expect(now).toMatchObject({ priority: "no-priority", userId: null });
    expect(now.workProjectId).toBeNull();
    expect(now.labels).toEqual([]);
  });

  it("applies only the fields the person kept", async () => {
    model.queue.push(suggestion());
    const id = await createTicket();
    const [card] = (await cards(owner, id)).body;
    const res = await as(owner).request(
      `/api/agent/workspace/${ws}/proposals/${card?.id}/accept?fields=labels,priority`,
      json("POST"),
    );
    expect(res.status, await res.clone().text()).toBe(200);
    expect((await res.json()).status).toBe("accepted");
    const now = await ticket(id);
    expect(now.priority).toBe("high");
    expect(now.labels).toEqual(["Browser", "Bug"]);
    expect(now.userId).toBeNull();
    expect(now.workProjectId).toBeNull();
  });

  it("applies every field when nothing is unticked", async () => {
    model.queue.push(suggestion());
    const id = await createTicket();
    const [card] = (await cards(owner, id)).body;
    const res = await as(owner).request(
      `/api/agent/workspace/${ws}/proposals/${card?.id}/accept`,
      json("POST"),
    );
    expect(res.status, await res.clone().text()).toBe(200);
    const now = await ticket(id);
    expect(now).toMatchObject({
      priority: "high",
      userId: teammate.id,
      workProjectId,
    });
  });

  it("leaves the ticket unchanged on Decline", async () => {
    model.queue.push(suggestion());
    const id = await createTicket();
    const before = await ticket(id);
    const [card] = (await cards(owner, id)).body;
    const res = await as(owner).request(
      `/api/agent/workspace/${ws}/proposals/${card?.id}/decline`,
      json("POST"),
    );
    expect(res.status).toBe(200);
    expect((await res.json()).status).toBe("declined");
    const after = await ticket(id);
    expect({ ...after, updatedAt: null }).toEqual({
      ...before,
      updatedAt: null,
    });
  });

  it("sends the team's guidance with the ticket, and auto-apply is off until turned on", async () => {
    const initial = await settings(owner);
    expect(initial.status).toBe(200);
    expect(await initial.json()).toEqual({ guidance: "", autoApply: false });

    const saved = await settings(owner, {
      guidance: "Browser bugs go to the web project at urgent priority.",
      autoApply: false,
    });
    expect(saved.status, await saved.clone().text()).toBe(200);
    model.queue.push(
      suggestion({ priority: { value: "urgent", reason: "Team rule" } }),
    );
    const id = await createTicket();
    expect(JSON.stringify(model.seen[0])).toContain(
      "Browser bugs go to the web project at urgent priority.",
    );
    const [card] = (await cards(owner, id)).body;
    expect(card?.diff.find((c) => c.field === "priority")?.to).toBe("urgent");
    expect((await ticket(id)).priority).toBe("no-priority");
  });

  it("applies the suggestion at once when the team turned auto-apply on", async () => {
    await settings(owner, { guidance: "", autoApply: true });
    model.queue.push(suggestion());
    const id = await createTicket();
    const now = await ticket(id);
    expect(now).toMatchObject({ priority: "high", userId: teammate.id });
    expect(now.labels).toEqual(["Browser", "Bug"]);
    const [card] = (await cards(owner, id)).body;
    expect(card?.status).toBe("accepted");
  });

  it("only lets people who can change the team set its guidance", async () => {
    const viewer = await addWorkspaceMember(ws, "viewer");
    const res = await settings(viewer, { guidance: "x", autoApply: true });
    expect(res.status).toBe(403);
    const elsewhere = await createWorkspaceMember({ role: "owner" });
    const foreign = await as(elsewhere.user).request(
      `/api/agent/workspace/${elsewhere.workspace.id}/teams/${team.project.id}/triage-settings`,
    );
    expect(foreign.status).toBe(404);
  });

  it("hides a team's settings from a member who cannot open the team", async () => {
    const other = await createProjectFixture({ workspaceId: ws });
    await restrictToProjects(ws, teammate.id, [other.project.id]);
    expect((await settings(teammate)).status).toBe(404);
  });

  it("drops an assignee who cannot open the team and a project of another workspace", async () => {
    const other = await createProjectFixture({ workspaceId: ws });
    await restrictToProjects(ws, teammate.id, [other.project.id]);
    const elsewhere = await createWorkspaceMember({ role: "owner" });
    const [foreign] = await db
      .insert(schema.workProjectTable)
      .values({ workspaceId: elsewhere.workspace.id, name: "Secret plan" })
      .returning();
    model.queue.push(
      suggestion({
        project: { value: foreign?.id, reason: "x" },
      }),
    );
    const id = await createTicket();
    const [card] = (await cards(owner, id)).body;
    const fields = card?.diff.map((c) => c.field).sort();
    expect(fields).toEqual(["labels", "priority"]);
    expect(JSON.stringify(card)).not.toContain("Secret plan");
  });

  it("shows the card only to the person it was made for", async () => {
    model.queue.push(suggestion());
    const id = await createTicket();
    const [card] = (await cards(owner, id)).body;
    expect((await cards(teammate, id)).body).toEqual([]);
    const res = await as(teammate).request(
      `/api/agent/workspace/${ws}/proposals/${card?.id}/accept`,
      json("POST"),
    );
    expect(res.status).toBe(404);
  });

  it("asks nothing for a ticket outside triage, and nothing when AI is off", async () => {
    await createTicket(owner, "to-do");
    expect(model.seen).toHaveLength(0);
    delete process.env.OPENROUTER_API_KEY;
    const id = await createTicket();
    expect(model.seen).toHaveLength(0);
    expect((await cards(owner, id)).status).toBe(404);
  });

  it("asks the model nothing while the workspace has AI triage off, the default", async () => {
    const elsewhere = await createWorkspaceMember({ role: "owner" });
    const fresh = await as(elsewhere.user).request(
      `/api/agent/workspace/${elsewhere.workspace.id}/ai-features`,
    );
    expect(await fresh.json()).toEqual({
      triage: false,
      prSummary: false,
      chatAssistant: false,
    });
    await features(owner, { triage: false, prSummary: false });
    model.queue.push(suggestion());
    const id = await createTicket();
    expect(model.seen).toHaveLength(0);
    expect((await cards(owner, id)).body).toEqual([]);
  });

  it("lets only a workspace admin switch AI features", async () => {
    const res = await features(teammate, { triage: false, prSummary: true });
    expect(res.status).toBe(403);
    expect((await features(teammate)).status).toBe(200);
  });

  it("still creates the ticket when the model fails", async () => {
    const id = await createTicket();
    expect((await ticket(id)).title).toBe("Login fails on Safari");
    expect((await cards(owner, id)).body).toEqual([]);
  });
});
