import { sql } from "drizzle-orm";
import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "vite-plus/test";
import db, { schema } from "../../apps/api/src/database";
import {
  documentTable,
  meetingNotesRunTable,
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
const { app } = createApp();
const MARKER = "zebra-quartz-7731";
const TRANSCRIPT = [
  "Sam: Let's go with the annual plan, decided.",
  `Riley: I will draft the onboarding email by Friday ${MARKER}.`,
  "Sam: Someone should fix the broken invoice export.",
  "Riley: Agreed, that one is mine too.",
].join("\n");

const scripted = () =>
  reply(
    JSON.stringify({
      decisions: [
        {
          text: "Use the annual plan",
          quote: "Let's go with the annual plan, decided.",
        },
        { text: "Invented decision", quote: "words nobody said" },
      ],
      actionItems: [
        {
          title: "Draft the onboarding email",
          description: "Due Friday",
          quote: `I will draft the onboarding email by Friday ${MARKER}.`,
        },
        {
          title: "Fix the invoice export",
          description: "",
          quote: "Someone should fix the broken invoice export.",
        },
      ],
    }),
  );

const call = (user: User, path: string, method = "GET", body?: object) => {
  mockAuthenticatedSession(user);
  return app.request(`/api/meeting-notes${path}`, {
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
  const owner = await createWorkspaceMember({ role: "owner" });
  const ws = owner.workspace.id;
  const project = await createProjectFixture({ workspaceId: ws, slug: "ops" });
  const [doc] = await db
    .insert(documentTable)
    .values({
      workspaceId: ws,
      title: "Weekly sync",
      creatorId: owner.user.id,
      scope: "workspace",
    })
    .returning();
  return { owner: owner.user, ws, project, doc };
}

/** Every public table whose rows contain `needle` anywhere. */
async function tablesContaining(needle: string) {
  const { rows } = await db.execute<{ table_name: string }>(
    sql`select table_name from information_schema.tables where table_schema = 'public' and table_type = 'BASE TABLE'`,
  );
  const hits: string[] = [];
  for (const { table_name } of rows) {
    const result = await db.execute<{ n: number }>(
      sql`select count(*)::int as n from ${sql.identifier(table_name)} t where t::text like ${`%${needle}%`}`,
    );
    if ((result.rows[0]?.n ?? 0) > 0) hits.push(table_name);
  }
  return hits;
}

describe("API integration: meeting notes", () => {
  beforeEach(async () => {
    await resetTestDatabase();
    process.env.OPENROUTER_API_KEY = "test-key";
    model.queue.length = 0;
    model.seen.length = 0;
  });
  afterEach(() => {
    vi.unstubAllGlobals();
    delete process.env.STT_API_KEY;
  });

  it("proposes decisions and tickets with quotes, and Accept creates the tickets", async () => {
    const { owner, ws, project, doc } = await setup();
    model.queue.push(scripted());
    const res = await call(
      owner,
      `/workspace/${ws}/documents/${doc.id}/notes`,
      "POST",
      {
        transcript: TRANSCRIPT,
        keep: true,
      },
    );
    expect(res.status, await res.clone().text()).toBe(200);
    const proposal = await res.json();
    // A quote that is not in the transcript is dropped with its item.
    expect(proposal.decisions).toEqual([
      {
        text: "Use the annual plan",
        quote: "Let's go with the annual plan, decided.",
      },
    ]);
    expect(
      proposal.actionItems.map((item: { title: string }) => item.title),
    ).toEqual(["Draft the onboarding email", "Fix the invoice export"]);
    expect(JSON.stringify(model.seen[0])).toContain("broken invoice export");
    const [kept] = await db.select().from(meetingNotesRunTable);
    expect(kept?.transcript).toBe(TRANSCRIPT);
    const latest = await (
      await call(owner, `/workspace/${ws}/documents/${doc.id}/notes`)
    ).json();
    expect(latest.run.actionItems).toHaveLength(2);
    // My kept run is mine: another member of the workspace sees none.
    const member = (await createWorkspaceMember()).user;
    await db.insert(schema.workspaceUserTable).values({
      workspaceId: ws,
      userId: member.id,
      role: "member",
      joinedAt: new Date(),
    });
    expect(
      (
        await (
          await call(member, `/workspace/${ws}/documents/${doc.id}/notes`)
        ).json()
      ).run,
    ).toBeNull();
    const stranger = await createWorkspaceMember({ role: "owner" });
    expect(
      (
        await call(
          stranger.user,
          `/workspace/${stranger.workspace.id}/documents/${doc.id}/notes`,
        )
      ).status,
    ).toBe(404);

    const accept = await call(
      owner,
      `/workspace/${ws}/documents/${doc.id}/accept`,
      "POST",
      {
        projectId: project.project.id,
        items: proposal.actionItems.map(
          (item: { title: string; description: string }) => ({
            title: item.title,
            description: item.description,
          }),
        ),
      },
    );
    expect(accept.status, await accept.clone().text()).toBe(200);
    const created = await accept.json();
    expect(created.tasks).toHaveLength(2);
    const tasks = await db.select().from(schema.taskTable);
    expect(tasks.map((task) => task.title).sort()).toEqual([
      "Draft the onboarding email",
      "Fix the invoice export",
    ]);
  });

  it("keeps no transcript text anywhere when the user chooses do not keep", async () => {
    const { owner, ws, project, doc } = await setup();
    model.queue.push(scripted());
    const res = await call(
      owner,
      `/workspace/${ws}/documents/${doc.id}/notes`,
      "POST",
      {
        transcript: TRANSCRIPT,
        keep: false,
      },
    );
    expect(res.status).toBe(200);
    const proposal = await res.json();
    expect(proposal.runId).toBeNull();
    // The quotes are shown, but never stored.
    expect(JSON.stringify(proposal)).toContain(MARKER);
    await call(owner, `/workspace/${ws}/documents/${doc.id}/accept`, "POST", {
      projectId: project.project.id,
      items: [
        { title: "Draft the onboarding email", description: "Due Friday" },
      ],
    });
    expect(await tablesContaining(MARKER)).toEqual([]);
    expect(
      (
        await (
          await call(owner, `/workspace/${ws}/documents/${doc.id}/notes`)
        ).json()
      ).run,
    ).toBeNull();
  });

  it("refuses a document the caller cannot open, before asking the model", async () => {
    const { ws, owner } = await setup();
    const [privateDoc] = await db
      .insert(documentTable)
      .values({
        workspaceId: ws,
        title: "Mine",
        creatorId: owner.id,
        scope: "private",
      })
      .returning();
    const member = (await createWorkspaceMember()).user;
    await db.insert(schema.workspaceUserTable).values({
      workspaceId: ws,
      userId: member.id,
      role: "member",
      joinedAt: new Date(),
    });
    const res = await call(
      member,
      `/workspace/${ws}/documents/${privateDoc.id}/notes`,
      "POST",
      {
        transcript: TRANSCRIPT,
        keep: false,
      },
    );
    expect(res.status).toBe(404);
    expect(model.seen).toHaveLength(0);
  });

  it("creates tickets only in a team the caller can open, and only with task:create", async () => {
    const { ws, doc } = await setup();
    const member = (await createWorkspaceMember()).user;
    await db.insert(schema.workspaceUserTable).values({
      workspaceId: ws,
      userId: member.id,
      role: "member",
      joinedAt: new Date(),
    });
    const hidden = await createProjectFixture({ workspaceId: ws });
    const open = await createProjectFixture({ workspaceId: ws });
    await restrictToProjects(ws, member.id, [open.project.id]);
    const refused = await call(
      member,
      `/workspace/${ws}/documents/${doc.id}/accept`,
      "POST",
      {
        projectId: hidden.project.id,
        items: [{ title: "Sneaky", description: "" }],
      },
    );
    expect(refused.status).toBe(404);
    const viewer = (await createWorkspaceMember()).user;
    await db.insert(schema.workspaceUserTable).values({
      workspaceId: ws,
      userId: viewer.id,
      role: "viewer",
      joinedAt: new Date(),
    });
    const noCreate = await call(
      viewer,
      `/workspace/${ws}/documents/${doc.id}/accept`,
      "POST",
      {
        projectId: open.project.id,
        items: [{ title: "Viewer task", description: "" }],
      },
    );
    expect(noCreate.status).toBe(403);
    expect(await db.select().from(schema.taskTable)).toEqual([]);
  });

  it("transcribes audio through the speech-to-text service, and is off without its key", async () => {
    const { owner, ws } = await setup();
    const upload = () => {
      const form = new FormData();
      form.append(
        "file",
        new File([new Uint8Array([1, 2, 3])], "sync.m4a", {
          type: "audio/mp4",
        }),
      );
      mockAuthenticatedSession(owner);
      return app.request(`/api/meeting-notes/workspace/${ws}/transcribe`, {
        method: "POST",
        body: form,
      });
    };
    const off = await upload();
    expect(off.status).toBe(404);
    expect((await off.json()).message).toMatch(/speech to text is off/i);

    process.env.STT_API_KEY = "test-stt-key";
    process.env.STT_API_URL =
      "https://stt.example.test/v1/audio/transcriptions";
    const sttCalls: string[] = [];
    const realFetch = globalThis.fetch;
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: string | URL, init?: RequestInit) => {
        if (String(url) !== process.env.STT_API_URL)
          return realFetch(url, init);
        sttCalls.push(String(url));
        return new Response(JSON.stringify({ text: "Sam: ship on Friday." }));
      }),
    );
    const res = await upload();
    expect(res.status, await res.clone().text()).toBe(200);
    expect(await res.json()).toEqual({ transcript: "Sam: ship on Friday." });
    expect(sttCalls).toHaveLength(1);
    delete process.env.STT_API_URL;
  });

  it("refuses a recording over 25 MB before reading it", async () => {
    const { owner, ws } = await setup();
    process.env.STT_API_KEY = "test-stt-key";
    const sttCalls: string[] = [];
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: string | URL) => {
        sttCalls.push(String(url));
        return new Response(JSON.stringify({ text: "never" }));
      }),
    );
    const path = `/api/meeting-notes/workspace/${ws}/transcribe`;
    // A declared size over the limit is refused from the header alone.
    mockAuthenticatedSession(owner);
    const declared = await app.request(path, {
      method: "POST",
      headers: {
        "Content-Type": "multipart/form-data; boundary=x",
        "Content-Length": String(30 * 1024 * 1024),
      },
      body: "--x--",
    });
    expect(declared.status).toBe(413);

    // Without a size, reading stops once the limit is passed.
    let pulled = 0;
    const chunk = new Uint8Array(1024 * 1024);
    const stream = new ReadableStream<Uint8Array>({
      pull(controller) {
        pulled += 1;
        if (pulled > 40) controller.close();
        else controller.enqueue(chunk);
      },
    });
    mockAuthenticatedSession(owner);
    const streamed = await app.request(path, {
      method: "POST",
      headers: { "Content-Type": "multipart/form-data; boundary=x" },
      body: stream,
      duplex: "half",
    } as RequestInit);
    expect(streamed.status).toBe(413);
    expect(pulled).toBeLessThan(40);
    expect(sttCalls).toEqual([]);
  });

  it("is off without a model key", async () => {
    const { owner, ws, doc } = await setup();
    delete process.env.OPENROUTER_API_KEY;
    const res = await call(
      owner,
      `/workspace/${ws}/documents/${doc.id}/notes`,
      "POST",
      {
        transcript: TRANSCRIPT,
        keep: false,
      },
    );
    expect(res.status).toBe(404);
  });
});
