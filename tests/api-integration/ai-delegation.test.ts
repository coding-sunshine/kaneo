import { createServer, type Server } from "node:http";
import type { AddressInfo } from "node:net";
import { and, eq } from "drizzle-orm";
import {
  afterAll,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "vite-plus/test";
import db, { schema } from "../../apps/api/src/database";
import { settleEvents } from "../../apps/api/src/events";
import { createApp } from "../../apps/api/src/index";
import { model, reply } from "./helpers/agent-model";
import { mockAnonymousSession, mockAuthenticatedSession } from "./helpers/auth";
import { resetTestDatabase } from "./helpers/database";
import {
  createProjectFixture,
  createWorkspaceMember,
} from "./helpers/fixtures";
import { addWorkspaceMember } from "./helpers/project-access/add-workspace-member";
import { createTaskFixture } from "./helpers/project-access/create-task-fixture";
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
type Received = { path: string; auth: string | undefined; body: any };

// A stand-in for the coding agent service: it records what it is sent and
// answers with a run id, or fails when told to.
const fake = {
  received: [] as Received[],
  fail: false,
  server: null as Server | null,
  url: "",
};

const json = (method: string, body?: unknown) => ({
  method,
  headers: { "content-type": "application/json" },
  ...(body === undefined ? {} : { body: JSON.stringify(body) }),
});

describe("API integration: delegate a ticket to a coding agent", () => {
  const { app } = createApp();
  let owner: User;
  let ws: string;
  let team: Awaited<ReturnType<typeof createProjectFixture>>;
  let task: typeof schema.taskTable.$inferSelect;

  beforeAll(async () => {
    fake.server = createServer((req, res) => {
      let raw = "";
      req.on("data", (chunk) => {
        raw += chunk;
      });
      req.on("end", () => {
        fake.received.push({
          path: req.url ?? "",
          auth: req.headers.authorization,
          body: raw ? JSON.parse(raw) : null,
        });
        res.setHeader("content-type", "application/json");
        if (fake.fail) {
          res.statusCode = 500;
          res.end(JSON.stringify({ error: "down" }));
          return;
        }
        res.end(JSON.stringify({ id: "external-run-1" }));
      });
    });
    await new Promise<void>((resolve) =>
      fake.server?.listen(0, "127.0.0.1", resolve),
    );
    const { port } = fake.server.address() as AddressInfo;
    fake.url = `http://127.0.0.1:${port}`;
  });

  afterAll(async () => {
    await new Promise((resolve) => fake.server?.close(resolve));
  });

  beforeEach(async () => {
    await resetTestDatabase();
    process.env.OPENROUTER_API_KEY = "test-key";
    process.env.CODING_AGENT_URL = fake.url;
    process.env.CODING_AGENT_API_KEY = "fake-agent-key";
    process.env.CODING_AGENT_NAME = "Test agent";
    fake.received.length = 0;
    fake.fail = false;
    model.queue.length = 0;
    model.seen.length = 0;
    const member = await createWorkspaceMember({ role: "owner" });
    owner = member.user;
    ws = member.workspace.id;
    team = await createProjectFixture({ workspaceId: ws });
    task = await createTaskFixture(team, "Fix the login redirect", owner.id);
  });

  const as = (user: User) => {
    mockAuthenticatedSession(user);
    return app;
  };
  const delegate = (user: User, taskId = task.id, workspaceId = ws) =>
    as(user).request(
      `/api/agent/workspace/${workspaceId}/tasks/${taskId}/delegate`,
      json("POST"),
    );
  const decide = (user: User, id: string, decision: "accept" | "decline") =>
    as(user).request(
      `/api/agent/workspace/${ws}/proposals/${id}/${decision}`,
      json("POST"),
    );
  const ticket = async () =>
    (
      await db
        .select()
        .from(schema.taskTable)
        .where(eq(schema.taskTable.id, task.id))
    )[0];
  const links = () =>
    db
      .select()
      .from(schema.externalLinkTable)
      .where(
        and(
          eq(schema.externalLinkTable.taskId, task.id),
          eq(schema.externalLinkTable.resourceType, "pull_request"),
        ),
      );
  // The agent calls back with no session, only the run's token.
  const callback = (runId: string, token: string, body: object) => {
    mockAnonymousSession();
    return app.request(`/api/coding-agent/runs/${runId}/events`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(body),
    });
  };

  // Delegates and accepts; returns the run as the service was told about it.
  const startRun = async () => {
    const card = await (await delegate(owner)).json();
    const accepted = await decide(owner, card.id, "accept");
    expect(accepted.status, await accepted.clone().text()).toBe(200);
    expect((await accepted.json()).status).toBe("accepted");
    const sent = fake.received[0]?.body;
    return {
      runId: sent.runId as string,
      token: sent.callbackToken as string,
    };
  };

  it("says when no coding agent is configured and refuses to delegate", async () => {
    delete process.env.CODING_AGENT_API_KEY;
    const config = await as(owner).request(
      `/api/agent/workspace/${ws}/coding-agent`,
    );
    expect(await config.json()).toEqual({ configured: false, name: null });
    const res = await delegate(owner);
    expect(res.status).toBe(503);
    const cards = await db.select().from(schema.agentProposalTable);
    expect(cards).toEqual([]);
  });

  it("shows a proposal card first and contacts nobody until it is accepted", async () => {
    const config = await as(owner).request(
      `/api/agent/workspace/${ws}/coding-agent`,
    );
    expect(await config.json()).toEqual({
      configured: true,
      name: "Test agent",
    });
    const res = await delegate(owner);
    expect(res.status, await res.clone().text()).toBe(200);
    const card = await res.json();
    expect(card).toMatchObject({ tool: "delegate_task", status: "pending" });
    expect(card.diff).toEqual([
      { field: "agent", from: null, to: "Test agent" },
    ]);
    const list = await as(owner).request(
      `/api/agent/workspace/${ws}/tasks/${task.id}/proposals`,
    );
    expect((await list.json()).map((p: { id: string }) => p.id)).toEqual([
      card.id,
    ]);
    expect(fake.received).toEqual([]);
    expect((await ticket())?.status).toBe("to-do");
  });

  it("starts the run on Accept, moves the ticket to In Progress and lists it in the AI audit", async () => {
    await startRun();
    expect(fake.received).toHaveLength(1);
    const [sent] = fake.received;
    expect(sent?.path).toBe("/runs");
    expect(sent?.auth).toBe("Bearer fake-agent-key");
    expect(sent?.body.task).toMatchObject({
      id: task.id,
      title: "Fix the login redirect",
    });
    expect(sent?.body.callbackUrl).toContain(
      `/api/coding-agent/runs/${sent?.body.runId}/events`,
    );
    expect(sent?.body.mcpUrl).toContain("/api/mcp");
    expect((await ticket())?.status).toBe("in-progress");

    const audit = await as(owner).request(`/api/agent/workspace/${ws}/audit`);
    const rows = (await audit.json()) as { tool: string; status: string }[];
    expect(rows.map((row) => [row.tool, row.status])).toEqual([
      ["delegate_task", "accepted"],
    ]);
    const runs = await as(owner).request(
      `/api/agent/workspace/${ws}/tasks/${task.id}/delegations`,
    );
    expect(await runs.json()).toMatchObject([
      { status: "running", agent: "Test agent", pullRequestUrl: null },
    ]);
  });

  it("attaches the pull request when the agent opens one, and echoes the merge to the ticket", async () => {
    const { runId, token } = await startRun();
    const opened = await callback(runId, token, {
      type: "pull_request.opened",
      pullRequest: {
        url: "https://git.example.test/acme/web/pull/7",
        title: "Fix login redirect",
      },
    });
    expect(opened.status, await opened.clone().text()).toBe(200);
    const [link] = await links();
    expect(link).toMatchObject({
      url: "https://git.example.test/acme/web/pull/7",
      title: "Fix login redirect",
    });
    expect(JSON.parse(link?.metadata ?? "{}")).toMatchObject({
      state: "open",
      merged: false,
    });

    model.queue.push(
      reply(
        JSON.stringify({
          summary: "The redirect keeps the session.",
          risk: "low",
          riskReason: "Small change.",
        }),
      ),
    );
    const merged = await callback(runId, token, {
      type: "pull_request.merged",
    });
    expect(merged.status).toBe(200);
    expect((await ticket())?.status).toBe("done");
    // The merge also drafts a summary comment for the person who delegated.
    await settleEvents();
    const cards = await as(owner).request(
      `/api/agent/workspace/${ws}/tasks/${task.id}/proposals`,
    );
    const summary = (
      (await cards.json()) as { tool: string; diff: { to: string }[] }[]
    ).find((card) => card.tool === "create_task_comment");
    expect(summary?.diff[0]?.to).toContain("The redirect keeps the session.");
    const [after] = await links();
    expect(JSON.parse(after?.metadata ?? "{}")).toMatchObject({
      merged: true,
    });
    const runs = await as(owner).request(
      `/api/agent/workspace/${ws}/tasks/${task.id}/delegations`,
    );
    expect(await runs.json()).toMatchObject([
      {
        status: "merged",
        pullRequestUrl: "https://git.example.test/acme/web/pull/7",
      },
    ]);
  });

  it("ignores a callback without the run's own token", async () => {
    const { runId } = await startRun();
    const forged = await callback(runId, "not-the-token", {
      type: "pull_request.merged",
    });
    expect(forged.status).toBe(404);
    const unknown = await callback("no-such-run", "x", {
      type: "pull_request.merged",
    });
    expect(unknown.status).toBe(404);
    expect((await ticket())?.status).toBe("in-progress");
  });

  it("refuses a pull request link that is not a web address", async () => {
    const { runId, token } = await startRun();
    const res = await callback(runId, token, {
      type: "pull_request.opened",
      pullRequest: { url: "javascript:alert(1)", title: "x" },
    });
    expect(res.status).toBe(400);
    expect(await links()).toEqual([]);
  });

  it("changes nothing and contacts nobody on Decline", async () => {
    const card = await (await delegate(owner)).json();
    const res = await decide(owner, card.id, "decline");
    expect((await res.json()).status).toBe("declined");
    expect(fake.received).toEqual([]);
    expect((await ticket())?.status).toBe("to-do");
  });

  it("leaves the ticket as it was when the agent service fails", async () => {
    fake.fail = true;
    const card = await (await delegate(owner)).json();
    const res = await decide(owner, card.id, "accept");
    expect((await res.json()).status).toBe("failed");
    expect((await ticket())?.status).toBe("to-do");
  });

  it("refuses a ticket the person cannot open, and a viewer who cannot change it", async () => {
    const other = await createProjectFixture({ workspaceId: ws });
    const outsider = await addWorkspaceMember(ws, "member");
    await restrictToProjects(ws, outsider.id, [other.project.id]);
    expect((await delegate(outsider)).status).toBe(404);
    const viewer = await addWorkspaceMember(ws, "viewer");
    expect((await delegate(viewer)).status).toBe(403);
    const elsewhere = await createWorkspaceMember({ role: "owner" });
    expect(
      (await delegate(elsewhere.user, task.id, elsewhere.workspace.id)).status,
    ).toBe(404);
    expect(
      (
        await as(outsider).request(
          `/api/agent/workspace/${ws}/tasks/${task.id}/delegations`,
        )
      ).status,
    ).toBe(404);
  });

  it("puts a delegation card on the ticket when a comment mentions the agent", async () => {
    const res = await as(owner).request(
      "/api/activity/comment",
      json("POST", {
        taskId: task.id,
        comment: "@agent please take this one",
      }),
    );
    expect(res.status, await res.clone().text()).toBe(200);
    await settleEvents();
    const list = await as(owner).request(
      `/api/agent/workspace/${ws}/tasks/${task.id}/proposals`,
    );
    const cards = (await list.json()) as { tool: string; status: string }[];
    expect(cards.map((card) => [card.tool, card.status])).toEqual([
      ["delegate_task", "pending"],
    ]);
    expect(fake.received).toEqual([]);
  });

  it("does not let anyone start a run without an accepted card", async () => {
    const res = await as(owner).request(
      `/api/agent/workspace/${ws}/delegations`,
      json("POST", { taskId: task.id }),
    );
    expect(res.status).toBe(404);
    expect(fake.received).toEqual([]);
  });
});
