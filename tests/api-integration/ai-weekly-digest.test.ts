import { eq } from "drizzle-orm";
import { beforeEach, describe, expect, it, vi } from "vite-plus/test";
import db, { schema } from "../../apps/api/src/database";
import { createApp } from "../../apps/api/src/index";
import { callTool, model, reply } from "./helpers/agent-model";
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
type Draft = {
  id: string;
  tool: string;
  status: string;
  diff: { field: string; to: string | null }[];
};

const json = (method: string, body?: unknown) => ({
  method,
  headers: { "content-type": "application/json" },
  ...(body === undefined ? {} : { body: JSON.stringify(body) }),
});

const HEADINGS = [
  "## Shipped",
  "## At risk",
  "## Needs decision",
  "## Blocked",
];

describe("API integration: weekly digest loop", () => {
  const { app } = createApp();
  let ceo: User;
  let lead: User;
  let ws: string;
  let workProjectId: string;
  let shipped: typeof schema.taskTable.$inferSelect;
  let decision: typeof schema.taskTable.$inferSelect;
  let secret: typeof schema.taskTable.$inferSelect;

  const ticket = async (
    team: Awaited<ReturnType<typeof createProjectFixture>>,
    number: number,
    title: string,
  ) => {
    const [row] = await db
      .insert(schema.taskTable)
      .values({
        projectId: team.project.id,
        title,
        number,
        status: team.columns.todo.slug,
        columnId: team.columns.todo.id,
      })
      .returning();
    if (!row) throw new Error("task not created");
    return row;
  };

  const as = (user: User) => {
    mockAuthenticatedSession(user);
    return app;
  };

  beforeEach(async () => {
    await resetTestDatabase();
    process.env.OPENROUTER_API_KEY = "test-key";
    model.queue.length = 0;
    model.seen.length = 0;
    const seeded = await createWorkspaceMember({ role: "owner" });
    ceo = seeded.user;
    ws = seeded.workspace.id;
    lead = await addWorkspaceMember(ws, "member");
    const web = await createProjectFixture({ workspaceId: ws });
    const restricted = await createProjectFixture({ workspaceId: ws });
    await restrictToProjects(ws, lead.id, [web.project.id]);
    shipped = await ticket(web, 1, "Search ships to everyone");
    decision = await ticket(web, 2, "Pick a billing vendor");
    secret = await ticket(restricted, 1, "Secret acquisition plan");
    const [project] = await db
      .insert(schema.workProjectTable)
      .values({ workspaceId: ws, name: "Company" })
      .returning();
    workProjectId = project?.id ?? "";
  });

  async function runDigest(creator: User = lead) {
    const created = await as(creator).request(
      "/api/loop",
      json("POST", {
        workspaceId: ws,
        name: "Weekly digest",
        instructions: "Write the weekly digest for the Company project.",
        frequency: "weekly",
        actions: ["draft_weekly_digest"],
      }),
    );
    expect(created.status, await created.clone().text()).toBe(200);
    const loop = await created.json();
    model.queue.push(
      callTool("draft_weekly_digest", {
        workProjectId,
        shipped: [{ taskId: shipped.id, note: "Live for all teams" }],
        atRisk: [{ taskId: secret.id, note: "Talks stalled" }],
        needsDecision: [
          { taskId: decision.id, note: "Two offers on the table" },
        ],
        blocked: [],
        reason: "The weekly digest",
      }),
      reply("Drafted the digest for you to accept."),
    );
    const run = await as(creator).request(
      `/api/loop/workspace/${ws}/${loop.id}/run`,
      json("POST"),
    );
    expect(run.status, await run.clone().text()).toBe(200);
    expect((await run.json()).status).toBe("succeeded");
  }

  const drafts = async (user: User) => {
    const res = await as(user).request(
      `/api/agent/workspace/${ws}/proposals/drafts`,
    );
    expect(res.status).toBe(200);
    return (await res.json()) as Draft[];
  };
  const bodyOf = (draft?: Draft) =>
    draft?.diff.find((change) => change.field === "update")?.to ?? "";
  const updates = () => db.select().from(schema.workProjectUpdateTable);
  const notifications = (user: User) =>
    db
      .select()
      .from(schema.notificationTable)
      .where(eq(schema.notificationTable.userId, user.id));

  it("drafts the digest with the four fixed headings and a ticket link on every line", async () => {
    await runDigest();
    const [draft, ...rest] = await drafts(lead);
    expect(rest).toEqual([]);
    expect(draft).toMatchObject({ status: "pending" });
    const body = bodyOf(draft);
    const positions = HEADINGS.map((heading) => body.indexOf(heading));
    expect(positions.every((at) => at >= 0)).toBe(true);
    expect([...positions].sort((a, b) => a - b)).toEqual(positions);
    const lines = body.split("\n").filter((line) => line.startsWith("- "));
    expect(lines).toHaveLength(2);
    for (const line of lines)
      expect(line).toMatch(/\]\(http[^)]+\/task\/[^)]+\)/);
    expect(body).toContain("Search ships to everyone");
    expect(body).toContain(`/task/${shipped.id}`);
    expect(body).toContain("Pick a billing vendor");
    expect(await updates()).toEqual([]);
  });

  it("leaves out tickets of a team the person running it cannot open", async () => {
    await runDigest();
    const body = bodyOf((await drafts(lead))[0]);
    expect(body).not.toContain("Secret acquisition plan");
    expect(body).not.toContain(secret.id);
    expect(body).not.toContain("Talks stalled");
  });

  it("posts it as a project update on Accept and tells the workspace owner in the inbox", async () => {
    await runDigest();
    const [draft] = await drafts(lead);
    const res = await as(lead).request(
      `/api/agent/workspace/${ws}/proposals/${draft?.id}/accept`,
      json("POST"),
    );
    expect(res.status, await res.clone().text()).toBe(200);
    expect((await res.json()).status).toBe("accepted");
    const [update] = await updates();
    expect(update).toMatchObject({ workProjectId, userId: lead.id });
    expect(update?.body).toContain("## Needs decision");
    const inbox = await notifications(ceo);
    expect(inbox).toMatchObject([
      {
        type: "weekly_digest",
        resourceType: "workspace",
        resourceId: ws,
        eventData: { workProjectId, projectName: "Company" },
      },
    ]);
    expect(await notifications(lead)).toEqual([]);
  });

  it("posts nothing and tells nobody on Decline", async () => {
    await runDigest();
    const [draft] = await drafts(lead);
    await as(lead).request(
      `/api/agent/workspace/${ws}/proposals/${draft?.id}/decline`,
      json("POST"),
    );
    expect(await updates()).toEqual([]);
    expect(await notifications(ceo)).toEqual([]);
  });

  it("keeps the draft private to the person who ran the loop", async () => {
    await runDigest();
    expect(await drafts(ceo)).toEqual([]);
    const [draft] = await drafts(lead);
    const res = await as(ceo).request(
      `/api/agent/workspace/${ws}/proposals/${draft?.id}/accept`,
      json("POST"),
    );
    expect(res.status).toBe(404);
  });

  it("refuses a project of another workspace", async () => {
    const elsewhere = await createWorkspaceMember({ role: "owner" });
    const [foreign] = await db
      .insert(schema.workProjectTable)
      .values({ workspaceId: elsewhere.workspace.id, name: "Elsewhere" })
      .returning();
    workProjectId = foreign?.id ?? "";
    await runDigest();
    expect(await drafts(lead)).toEqual([]);
  });
});
