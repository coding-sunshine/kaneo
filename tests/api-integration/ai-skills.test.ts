import { eq } from "drizzle-orm";
import { beforeEach, describe, expect, it, vi } from "vite-plus/test";
import type { CompletionUsage } from "../../apps/api/src/agent/openrouter";
import db, { schema } from "../../apps/api/src/database";
import {
  aiSkillRunTable,
  chatChannelMemberTable,
  chatChannelTable,
} from "../../apps/api/src/database/schema";
import { createApp } from "../../apps/api/src/index";
import { model, reply } from "./helpers/agent-model";
import { mockAuthenticatedSession } from "./helpers/auth";
import { resetTestDatabase } from "./helpers/database";
import {
  createProjectFixture,
  createWorkspaceMember,
} from "./helpers/fixtures";
import { restrictToProjects } from "./helpers/project-access/restrict-to-projects";
import { skillStream } from "../../apps/api/src/skill/stream-skill-run";

// The scripted model also reports tokens, as the provider's last chunk does.
const usage = {
  tokens: { prompt: 120, completion: 30 },
  report: true,
  delayMs: 0,
};
vi.mock("../../apps/api/src/agent/openrouter", async (original) => ({
  ...(await original<object>()),
  createCompletion: vi.fn(
    async (
      messages: never,
      _tools: unknown,
      _onText: unknown,
      onUsage?: (usage: CompletionUsage) => void,
    ) => {
      model.seen.push(messages);
      const next = model.queue.shift();
      if (!next) throw new Error("no scripted reply");
      if (usage.delayMs)
        await new Promise((resolve) => setTimeout(resolve, usage.delayMs));
      if (usage.report)
        onUsage?.({
          model: "fake-model",
          promptTokens: usage.tokens.prompt,
          completionTokens: usage.tokens.completion,
          cost: null,
        });
      return next;
    },
  ),
}));

type User = typeof schema.userTable.$inferSelect;
const { app } = createApp();

const call = (
  user: User,
  path: string,
  method = "GET",
  body?: object,
): Promise<Response> => {
  mockAuthenticatedSession(user);
  return Promise.resolve(
    app.request(`/api/skill${path}`, {
      method,
      ...(body
        ? {
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(body),
          }
        : {}),
    }),
  );
};

async function setup() {
  const owner = await createWorkspaceMember({ role: "owner" });
  const ws = owner.workspace.id;
  const p = await createProjectFixture({ workspaceId: ws, slug: "pay" });
  const q = await createProjectFixture({ workspaceId: ws, slug: "ops" });
  let number = 0;
  const task = async (
    project: typeof p,
    title: string,
    description: string,
  ) => {
    number += 1;
    const [row] = await db
      .insert(schema.taskTable)
      .values({
        projectId: project.project.id,
        title,
        description,
        status: "to-do",
        columnId: project.columns.todo.id,
        number,
      })
      .returning();
    return row;
  };
  const pTask = await task(p, "Payments stuck", "Waiting on the vendor key");
  const qTask = await task(q, "Rotate pager", "Ops only secret runbook");
  const [channel] = await db
    .insert(chatChannelTable)
    .values({ workspaceId: ws, name: "general", createdBy: owner.user.id })
    .returning();
  return { owner: owner.user, ws, p, q, pTask, qTask, channel };
}

const createSkill = (user: User, ws: string, body: object) =>
  call(user, `/workspace/${ws}/skills`, "POST", body);

describe("API integration: custom AI skills", () => {
  beforeEach(async () => {
    await resetTestDatabase();
    process.env.OPENROUTER_API_KEY = "test-key";
    model.queue.length = 0;
    model.seen.length = 0;
    usage.tokens = { prompt: 120, completion: 30 };
    usage.report = true;
    usage.delayMs = 0;
  });

  it("saves a skill, runs it in a channel with a cited summary, and lists the run with tokens", async () => {
    const { owner, ws, pTask, channel } = await setup();
    const created = await createSkill(owner, ws, {
      name: "blockers",
      prompt: "List what blocks the team.",
    });
    expect(created.status, await created.clone().text()).toBe(200);
    const skill = (await created.json()) as { id: string; name: string };
    expect(skill.name).toBe("blockers");
    const list = await (await call(owner, `/workspace/${ws}/skills`)).json();
    expect(list.skills.map((s: { name: string }) => s.name)).toEqual([
      "blockers",
    ]);

    model.queue.push(
      reply(
        JSON.stringify({
          bullets: [
            { text: "Payments wait on the vendor key", sources: [pTask.id] },
            { text: "Invented", sources: ["made-up"] },
          ],
        }),
      ),
    );
    const run = await call(
      owner,
      `/workspace/${ws}/skills/${skill.id}/run`,
      "POST",
      { channelId: channel.id, input: "this week" },
    );
    expect(run.status, await run.clone().text()).toBe(200);
    const body = await run.json();
    expect(body.bullets).toEqual([
      {
        text: "Payments wait on the vendor key",
        sources: [
          expect.objectContaining({
            kind: "task",
            restricted: false,
            id: pTask.id,
            ticket: `PAY-${pTask.number}`,
          }),
        ],
      },
    ]);
    expect(body).toMatchObject({ promptTokens: 120, completionTokens: 30 });
    const sent = JSON.stringify(model.seen[0]);
    expect(sent).toContain("List what blocks the team.");
    expect(sent).toContain("this week");
    expect(sent).toContain("Waiting on the vendor key");

    const history = await (await call(owner, `/workspace/${ws}/runs`)).json();
    expect(history.runs).toEqual([
      expect.objectContaining({
        skillName: "blockers",
        channelId: channel.id,
        promptTokens: 120,
        completionTokens: 30,
      }),
    ]);
    // Only metadata and tokens are kept, not the answer.
    const [row] = await db.select().from(aiSkillRunTable);
    expect(JSON.stringify(row)).not.toContain("vendor");
  });

  it("a skill scoped to project P reads and cites nothing from project Q", async () => {
    const { owner, ws, p, qTask, channel } = await setup();
    const skill = await (
      await createSkill(owner, ws, {
        name: "blockers",
        prompt: "List blockers.",
        projectIds: [p.project.id],
      })
    ).json();
    model.queue.push(
      reply(
        JSON.stringify({
          bullets: [{ text: "Pager rotation", sources: [qTask.id] }],
        }),
      ),
    );
    const run = await call(
      owner,
      `/workspace/${ws}/skills/${skill.id}/run`,
      "POST",
      { channelId: channel.id },
    );
    expect(run.status).toBe(200);
    expect((await run.json()).bullets).toEqual([]);
    const sent = JSON.stringify(model.seen[0]);
    expect(sent).not.toContain("Rotate pager");
    expect(sent).not.toContain(qTask.id);
  });

  it("reads nothing once its scoped project is gone or hidden from the runner", async () => {
    const { owner, ws, p, q, channel } = await setup();
    const skill = await (
      await createSkill(owner, ws, {
        name: "blockers",
        prompt: "List blockers.",
        projectIds: [p.project.id],
      })
    ).json();
    await db
      .delete(schema.projectTable)
      .where(eq(schema.projectTable.id, p.project.id));
    const run = await call(
      owner,
      `/workspace/${ws}/skills/${skill.id}/run`,
      "POST",
      { channelId: channel.id },
    );
    expect(run.status, await run.clone().text()).toBe(200);
    expect((await run.json()).bullets).toEqual([]);
    expect(model.seen).toHaveLength(0);

    // A member restricted away from Q cannot scope a skill to it.
    const member = (await createWorkspaceMember()).user;
    await db.insert(schema.workspaceUserTable).values({
      workspaceId: ws,
      userId: member.id,
      role: "member",
      joinedAt: new Date(),
    });
    const other = await createProjectFixture({ workspaceId: ws });
    await restrictToProjects(ws, member.id, [other.project.id]);
    const refused = await createSkill(member, ws, {
      name: "peek",
      prompt: "Tell me.",
      projectIds: [q.project.id],
    });
    expect(refused.status).toBe(404);
  });

  it("stops a skill over its credit cap with a clear message, before the model", async () => {
    const { owner, ws, channel } = await setup();
    const skill = await (
      await createSkill(owner, ws, {
        name: "blockers",
        prompt: "List blockers.",
        monthlyTokenCap: 100,
      })
    ).json();
    model.queue.push(reply(JSON.stringify({ bullets: [] })));
    const run = (path = `/workspace/${ws}/skills/${skill.id}/run`) =>
      call(owner, path, "POST", { channelId: channel.id });
    expect((await run()).status).toBe(200);
    const capped = await run();
    expect(capped.status).toBe(429);
    expect((await capped.json()).message).toMatch(
      /blockers.*credit cap of 100 tokens/,
    );
    expect(model.seen).toHaveLength(1);
  });

  it("lets at most the allowed runs through when five start at once", async () => {
    const { owner, ws, channel } = await setup();
    const skill = await (
      await createSkill(owner, ws, {
        name: "blockers",
        prompt: "List blockers.",
        monthlyTokenCap: 100,
      })
    ).json();
    for (let i = 0; i < 5; i += 1)
      model.queue.push(reply(JSON.stringify({ bullets: [] })));
    const statuses = await Promise.all(
      Array.from({ length: 5 }, () =>
        call(owner, `/workspace/${ws}/skills/${skill.id}/run`, "POST", {
          channelId: channel.id,
        }).then((res) => res.status),
      ),
    );
    expect(statuses.filter((status) => status === 200)).toHaveLength(1);
    expect(statuses.filter((status) => status === 429)).toHaveLength(4);
    expect(model.seen).toHaveLength(1);
  });

  it("counts a run whose provider reports no usage", async () => {
    const { owner, ws, channel } = await setup();
    usage.report = false;
    const skill = await (
      await createSkill(owner, ws, {
        name: "blockers",
        prompt: "List blockers.",
        monthlyTokenCap: 50,
      })
    ).json();
    model.queue.push(reply(JSON.stringify({ bullets: [] })));
    model.queue.push(reply(JSON.stringify({ bullets: [] })));
    const run = () =>
      call(owner, `/workspace/${ws}/skills/${skill.id}/run`, "POST", {
        channelId: channel.id,
      });
    expect((await run()).status).toBe(200);
    const [row] = await db.select().from(aiSkillRunTable);
    expect(row?.promptTokens).toBeGreaterThan(0);
    expect((await run()).status).toBe(429);
  });

  it("keeps the month's usage when a skill is deleted and made again", async () => {
    const { owner, ws, channel } = await setup();
    const make = async () =>
      (
        await createSkill(owner, ws, {
          name: "blockers",
          prompt: "List blockers.",
          monthlyTokenCap: 100,
        })
      ).json();
    const first = await make();
    model.queue.push(reply(JSON.stringify({ bullets: [] })));
    model.queue.push(reply(JSON.stringify({ bullets: [] })));
    expect(
      (
        await call(owner, `/workspace/${ws}/skills/${first.id}/run`, "POST", {
          channelId: channel.id,
        })
      ).status,
    ).toBe(200);
    await call(owner, `/workspace/${ws}/skills/${first.id}`, "DELETE");
    const again = await make();
    const capped = await call(
      owner,
      `/workspace/${ws}/skills/${again.id}/run`,
      "POST",
      { channelId: channel.id },
    );
    expect(capped.status).toBe(429);
    expect(model.seen).toHaveLength(1);
  });

  it("keeps skills and runs private to their owner", async () => {
    const { owner, ws, channel } = await setup();
    const skill = await (
      await createSkill(owner, ws, { name: "blockers", prompt: "List." })
    ).json();
    model.queue.push(reply(JSON.stringify({ bullets: [] })));
    await call(owner, `/workspace/${ws}/skills/${skill.id}/run`, "POST", {
      channelId: channel.id,
    });
    const member = (await createWorkspaceMember()).user;
    await db.insert(schema.workspaceUserTable).values({
      workspaceId: ws,
      userId: member.id,
      role: "member",
      joinedAt: new Date(),
    });
    expect(
      (await (await call(member, `/workspace/${ws}/skills`)).json()).skills,
    ).toEqual([]);
    expect(
      (await (await call(member, `/workspace/${ws}/runs`)).json()).runs,
    ).toEqual([]);
    expect(
      (
        await call(member, `/workspace/${ws}/skills/${skill.id}/run`, "POST", {
          channelId: channel.id,
        })
      ).status,
    ).toBe(404);
    expect(
      (await call(member, `/workspace/${ws}/skills/${skill.id}`, "DELETE"))
        .status,
    ).toBe(404);
    expect(model.seen).toHaveLength(1);
    // The owner can delete it.
    expect(
      (await call(owner, `/workspace/${ws}/skills/${skill.id}`, "DELETE"))
        .status,
    ).toBe(200);
  });

  it("refuses a channel the runner cannot read, and a second skill with the same name", async () => {
    const { owner, ws } = await setup();
    const skill = await (
      await createSkill(owner, ws, { name: "blockers", prompt: "List." })
    ).json();
    expect(
      (await createSkill(owner, ws, { name: "blockers", prompt: "Again" }))
        .status,
    ).toBe(409);
    expect(
      (await createSkill(owner, ws, { name: "Bad Name!", prompt: "x" })).status,
    ).toBe(400);
    const stranger = await createWorkspaceMember({ role: "owner" });
    const [privateChannel] = await db
      .insert(chatChannelTable)
      .values({
        workspaceId: ws,
        name: "secret",
        isPrivate: true,
        createdBy: stranger.user.id,
      })
      .returning();
    await db
      .insert(chatChannelMemberTable)
      .values({ channelId: privateChannel.id, userId: stranger.user.id });
    const run = await call(
      owner,
      `/workspace/${ws}/skills/${skill.id}/run`,
      "POST",
      { channelId: privateChannel.id },
    );
    expect(run.status).toBe(404);
    expect(model.seen).toHaveLength(0);
  });

  it("refuses to run in a channel with AI turned off, before the model", async () => {
    const { owner, ws, channel } = await setup();
    const skill = await (
      await createSkill(owner, ws, { name: "blockers", prompt: "List." })
    ).json();
    await db
      .update(chatChannelTable)
      .set({ aiDisabled: true })
      .where(eq(chatChannelTable.id, channel.id));
    model.queue.push(reply(JSON.stringify({ bullets: [] })));
    const run = await call(
      owner,
      `/workspace/${ws}/skills/${skill.id}/run`,
      "POST",
      { channelId: channel.id },
    );
    expect(run.status).toBe(403);
    expect(model.seen).toHaveLength(0);
    expect(await db.select().from(aiSkillRunTable)).toEqual([]);
  });

  it("streams a long run: pings while the model works, then the answer", async () => {
    const { owner, ws, pTask, channel } = await setup();
    const skill = await (
      await createSkill(owner, ws, { name: "blockers", prompt: "List." })
    ).json();
    const pingMs = skillStream.pingMs;
    skillStream.pingMs = 20;
    usage.delayMs = 150;
    model.queue.push(
      reply(
        JSON.stringify({
          bullets: [{ text: "Payments wait", sources: [pTask.id] }],
        }),
      ),
    );
    try {
      const run = await call(
        owner,
        `/workspace/${ws}/skills/${skill.id}/run/stream`,
        "POST",
        { channelId: channel.id },
      );
      expect(run.status, await run.clone().text()).toBe(200);
      expect(run.headers.get("content-type")).toContain("text/event-stream");
      const events = (await run.text())
        .split("\n")
        .filter((line) => line.startsWith("data:"))
        .map((line) => JSON.parse(line.slice(5)));
      expect(
        events.filter((event) => event.type === "ping").length,
      ).toBeGreaterThan(1);
      expect(events.at(-1)).toMatchObject({
        type: "result",
        result: {
          skillName: "blockers",
          bullets: [
            expect.objectContaining({
              text: "Payments wait",
              sources: [expect.objectContaining({ id: pTask.id })],
            }),
          ],
        },
      });
    } finally {
      skillStream.pingMs = pingMs;
    }
  });

  it("streams a failed run as an error with its status, and refuses before streaming", async () => {
    const { owner, ws, channel } = await setup();
    const skill = await (
      await createSkill(owner, ws, { name: "blockers", prompt: "List." })
    ).json();
    model.queue.push(reply("not json"));
    const failed = await call(
      owner,
      `/workspace/${ws}/skills/${skill.id}/run/stream`,
      "POST",
      { channelId: channel.id },
    );
    expect(failed.status).toBe(200);
    expect(await failed.text()).toContain('"type":"error","status":502');

    await db
      .update(chatChannelTable)
      .set({ aiDisabled: true })
      .where(eq(chatChannelTable.id, channel.id));
    const refused = await call(
      owner,
      `/workspace/${ws}/skills/${skill.id}/run/stream`,
      "POST",
      { channelId: channel.id },
    );
    expect(refused.status).toBe(403);
  });

  it("is off without a model key", async () => {
    const { owner, ws } = await setup();
    delete process.env.OPENROUTER_API_KEY;
    expect((await call(owner, `/workspace/${ws}/skills`)).status).toBe(404);
  });
});
