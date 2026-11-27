import { eq } from "drizzle-orm";
import { beforeEach, describe, expect, it, vi } from "vite-plus/test";
import db, { schema } from "../../apps/api/src/database";
import { createApp } from "../../apps/api/src/index";
import { model, reply } from "./helpers/agent-model";
import { mockAuthenticatedSession } from "./helpers/auth";
import { resetTestDatabase } from "./helpers/database";
import {
  createProjectFixture,
  createWorkspaceMember,
} from "./helpers/fixtures";
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

const json = (method: string, body?: unknown) => ({
  method,
  headers: { "content-type": "application/json" },
  ...(body === undefined ? {} : { body: JSON.stringify(body) }),
});

describe("API integration: plain-English filters", () => {
  const { app } = createApp();
  let owner: User;
  let ws: string;
  let projectId: string;
  let bugId: string;

  beforeEach(async () => {
    await resetTestDatabase();
    process.env.OPENROUTER_API_KEY = "test-key";
    model.queue.length = 0;
    model.seen.length = 0;
    const member = await createWorkspaceMember({ role: "owner" });
    owner = member.user;
    ws = member.workspace.id;
    projectId = (await createProjectFixture({ workspaceId: ws })).project.id;
    const [bug] = await db
      .insert(schema.labelTable)
      .values({ name: "bug", color: "#ff0000", workspaceId: ws })
      .returning();
    bugId = bug?.id ?? "";
  });

  const parse = (user: User, text: string, project = projectId) => {
    mockAuthenticatedSession(user);
    return app.request(
      `/api/agent/workspace/${ws}/filters/parse`,
      json("POST", { projectId: project, text }),
    );
  };

  it("turns a sentence into the filter the board applies", async () => {
    model.queue.push(
      reply(
        JSON.stringify({
          assignee: ["me"],
          labels: ["bug"],
          blocked: true,
          createdOlderThanDays: 14,
        }),
      ),
    );
    const res = await parse(owner, "my blocked bugs older than 2 weeks");
    expect(res.status, await res.clone().text()).toBe(200);
    expect(await res.json()).toEqual({
      question: null,
      filters: {
        assignee: [owner.id],
        labels: [bugId],
        blocked: true,
        createdAt: ["olderThan:14"],
      },
    });
    // The model reads the sentence and the label names, nothing else.
    const sent = JSON.stringify(model.seen[0]);
    expect(sent).toContain("my blocked bugs older than 2 weeks");
    expect(sent).toContain("bug");
    expect(sent).not.toContain(owner.email);
  });

  it("names statuses by the value tickets carry, as the board does", async () => {
    const [column] = await db
      .select()
      .from(schema.columnTable)
      .where(eq(schema.columnTable.projectId, projectId));
    expect(column).toBeDefined();
    model.queue.push(reply(JSON.stringify({ status: [column?.name] })));
    const body = await (await parse(owner, "everything in that column")).json();
    expect(body.filters).toEqual({ status: [column?.slug] });
  });

  it("asks one question and applies nothing for an unclear sentence", async () => {
    model.queue.push(
      reply(JSON.stringify({ question: "Which tickets do you mean?" })),
    );
    const res = await parse(owner, "the usual ones");
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({
      filters: null,
      question: "Which tickets do you mean?",
    });
  });

  it("asks rather than guessing when the model's answer is not a filter", async () => {
    model.queue.push(reply("Sure, here you go."));
    const body = await (await parse(owner, "bugs please")).json();
    expect(body.filters).toBeNull();
    expect(body.question).toBeTruthy();
  });

  it("never names another workspace's labels", async () => {
    const other = await createWorkspaceMember({ role: "owner" });
    await db.insert(schema.labelTable).values({
      name: "secret-label",
      color: "#000000",
      workspaceId: other.workspace.id,
    });
    model.queue.push(reply(JSON.stringify({ labels: ["secret-label"] })));
    const body = await (await parse(owner, "secret-label tickets")).json();
    expect(body.filters).toBeNull();
    // Only the person's own sentence names it; the label list does not.
    expect(JSON.stringify(model.seen[0]).match(/secret-label/g)).toHaveLength(
      1,
    );
  });

  it("refuses a team the person cannot open, before asking the model", async () => {
    const closed = await createProjectFixture({ workspaceId: ws });
    const member = (await createWorkspaceMember()).user;
    await db.insert(schema.workspaceUserTable).values({
      workspaceId: ws,
      userId: member.id,
      role: "member",
      joinedAt: new Date(),
    });
    await restrictToProjects(ws, member.id, [projectId]);
    const res = await parse(member, "my bugs", closed.project.id);
    expect(res.status).toBe(404);
    expect(model.seen).toHaveLength(0);
  });

  it("refuses a team of another workspace", async () => {
    const other = await createWorkspaceMember({ role: "owner" });
    const foreign = await createProjectFixture({
      workspaceId: other.workspace.id,
    });
    const res = await parse(owner, "my bugs", foreign.project.id);
    expect(res.status).toBe(404);
    expect(model.seen).toHaveLength(0);
  });
});
