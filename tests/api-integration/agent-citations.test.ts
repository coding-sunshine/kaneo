import { beforeEach, describe, expect, it, vi } from "vite-plus/test";
import { eq } from "drizzle-orm";
import db from "../../apps/api/src/database";
import { activityTable, taskTable } from "../../apps/api/src/database/schema";
import { resolveCitations } from "../../apps/api/src/agent/resolve-citations";
import { callTool, model, reply } from "./helpers/agent-model";
import { resetTestDatabase } from "./helpers/database";
import {
  buildDocumentWorld,
  type DocumentWorld,
  json,
} from "./helpers/document-access/build-document-world";
import {
  createProjectFixture,
  createWorkspaceMember,
} from "./helpers/fixtures";
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

type Message = {
  role: string;
  content: string | null;
  citations?: Record<string, unknown>[];
  unsourced?: boolean;
};
type User = DocumentWorld["owner"];

// Two tool calls in one step would share an id; each step has its own.
const step = (name: string, args: object, n: number) => {
  const call = callTool(name, args);
  for (const tool of call.tool_calls ?? []) tool.id = `${tool.id}-${n}`;
  return call;
};

describe("API integration: sources on agent answers", () => {
  let world: DocumentWorld;
  let commentId: string;

  beforeEach(async () => {
    await resetTestDatabase();
    process.env.OPENROUTER_API_KEY = "test-key";
    model.queue.length = 0;
    model.seen.length = 0;
    world = await buildDocumentWorld();
    const [made] = await db
      .insert(activityTable)
      .values({
        taskId: world.betaTask.id,
        type: "comment",
        content: "Waiting on the vendor contract.",
        userId: world.owner.id,
      })
      .returning();
    commentId = made.id;
  });

  const ask = async (user: User, message: string, chatId?: string) => {
    const response = await world.as(user)(
      `/agent/workspace/${world.ws}/messages`,
      json("POST", { message, chatId }),
    );
    expect(response.status, await response.clone().text()).toBe(200);
    return (await response.json()) as { chatId: string; messages: Message[] };
  };
  const reread = async (user: User, chatId: string) => {
    const response = await world.as(user)(
      `/agent/workspace/${world.ws}/chats/${chatId}`,
    );
    expect(response.status).toBe(200);
    return ((await response.json()) as { messages: Message[] }).messages;
  };

  // The model reads the Beta issue, its comments and its team document, and
  // cites all three plus an id it never read.
  const readsBeta = () =>
    model.queue.push(
      step("get_task", { taskId: world.betaTask.id }, 1),
      step("list_task_comments", { taskId: world.betaTask.id }, 2),
      step(
        "get_document",
        { workspaceId: world.ws, documentId: world.docs.teamBeta },
        3,
      ),
      reply(
        `Beta issue waits on the vendor contract.\n\nSources: task:${world.betaTask.id} comment:${commentId} document:${world.docs.teamBeta} task:invented00000000000000000`,
      ),
    );

  it("ends an answer with a link for each task, comment and document it read", async () => {
    readsBeta();
    const { messages } = await ask(world.open, "what is blocking Beta issue?");

    const answer = messages.at(-1);
    expect(answer?.content).toBe("Beta issue waits on the vendor contract.");
    expect(answer?.unsourced).toBe(false);
    const ticket = `BETA-${world.betaTask.number}`;
    expect(answer?.citations).toEqual([
      {
        kind: "task",
        restricted: false,
        id: world.betaTask.id,
        title: "Beta issue",
        taskId: world.betaTask.id,
        projectId: world.beta.id,
        ticket,
      },
      {
        kind: "comment",
        restricted: false,
        id: commentId,
        title: "Beta issue",
        taskId: world.betaTask.id,
        projectId: world.beta.id,
        ticket,
      },
      {
        kind: "document",
        restricted: false,
        id: world.docs.teamBeta,
        title: "leakdoc teamBeta",
      },
    ]);
    // The model is told to name its sources, and keeps them in its history.
    expect(model.seen[0]?.[0]?.content).toContain("Sources:");
  });

  it("labels an answer unsourced when it names no source a tool returned", async () => {
    model.queue.push(reply("I cannot tell from the workspace.\nSources: none"));
    const { chatId, messages } = await ask(world.owner, "what is the weather?");
    expect(messages.at(-1)).toMatchObject({
      content: "I cannot tell from the workspace.",
      citations: [],
      unsourced: true,
    });

    model.queue.push(reply("No line at all."));
    await ask(world.owner, "and tomorrow?", chatId);
    // An id that only came back in an earlier turn does not count either.
    model.queue.push(
      step("get_task", { taskId: world.alphaTask.id }, 1),
      reply("Alpha issue is open.\nSources: task:notreadnotreadnotread00"),
    );
    await ask(world.owner, "is Alpha issue open?", chatId);
    model.queue.push(reply(`Still open.\nSources: task:${world.alphaTask.id}`));
    await ask(world.owner, "still?", chatId);

    const answers = (await reread(world.owner, chatId)).filter(
      (message) => message.role === "assistant" && message.content,
    );
    expect(answers.map((answer) => answer.unsourced)).toEqual([
      true,
      true,
      true,
      true,
    ]);
  });

  it("shows a restricted item with no title once the reader cannot open the source", async () => {
    readsBeta();
    const { chatId } = await ask(world.open, "what is blocking Beta issue?");
    await restrictToProjects(world.ws, world.open.id, [world.alpha.id]);

    const answer = (await reread(world.open, chatId)).at(-1);
    expect(answer?.unsourced).toBe(false);
    expect(answer?.citations).toEqual([
      { kind: "task", restricted: true },
      { kind: "comment", restricted: true },
      { kind: "document", restricted: true },
    ]);
  });

  it("shows a deleted source like one the reader cannot open", async () => {
    readsBeta();
    const { chatId } = await ask(world.owner, "what is blocking Beta issue?");
    await db.delete(taskTable).where(eq(taskTable.id, world.betaTask.id));

    const answer = (await reread(world.owner, chatId)).at(-1);
    expect(answer?.citations?.slice(0, 2)).toEqual([
      { kind: "task", restricted: true },
      { kind: "comment", restricted: true },
    ]);
  });

  it("opens no source of another workspace, or without the task permission", async () => {
    const other = await createWorkspaceMember({ role: "owner" });
    const project = await createProjectFixture({
      workspaceId: other.workspace.id,
      name: "Elsewhere",
    });
    const foreign = await createTaskFixture(
      project,
      "Elsewhere issue",
      other.user.id,
    );
    const reader = {
      userId: world.owner.id,
      workspaceId: world.ws,
      mayReadTasks: true,
    };
    expect(
      await resolveCitations(reader, [
        { kind: "task", id: foreign.id },
        { kind: "task", id: world.alphaTask.id },
      ]),
    ).toEqual([
      { kind: "task", restricted: true },
      expect.objectContaining({ restricted: false, title: "Alpha issue" }),
    ]);
    expect(
      await resolveCitations({ ...reader, mayReadTasks: false }, [
        { kind: "task", id: world.alphaTask.id },
        { kind: "document", id: world.docs.workspace },
        { kind: "comment", id: commentId },
      ]),
    ).toEqual([
      { kind: "task", restricted: true },
      { kind: "document", restricted: true },
      { kind: "comment", restricted: true },
    ]);
  });

  it("keeps a document a restricted member cannot open restricted for them", async () => {
    const reader = {
      userId: world.limited.id,
      workspaceId: world.ws,
      mayReadTasks: true,
    };
    expect(
      await resolveCitations(reader, [
        { kind: "document", id: world.docs.teamBeta },
        { kind: "document", id: world.docs.teamAlpha },
        { kind: "comment", id: commentId },
      ]),
    ).toEqual([
      { kind: "document", restricted: true },
      expect.objectContaining({
        restricted: false,
        title: "leakdoc teamAlpha",
      }),
      { kind: "comment", restricted: true },
    ]);
  });
});
