import { and, eq } from "drizzle-orm";
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
  emailIntakeFailureTable,
  emailIntakeMessageTable,
} from "../../apps/api/src/database/schema";
import { createFakePop3Server } from "../../apps/api/src/email-intake/fake-pop3-server";
import { pollIntakeMailbox } from "../../apps/api/src/email-intake/poll-intake-mailbox";
import { settleEvents } from "../../apps/api/src/events";
import { createApp } from "../../apps/api/src/index";
import { mockAuthenticatedSession } from "./helpers/auth";
import { resetTestDatabase } from "./helpers/database";
import {
  createProjectFixture,
  createWorkspaceMember,
} from "./helpers/fixtures";
import { addWorkspaceMember } from "./helpers/project-access/add-workspace-member";
import { restrictToProjects } from "./helpers/project-access/restrict-to-projects";
import { sentTicketReplies, ticketReplyTransport } from "./mocks/email";

// Filing fails while `filing.broken` is set, the way a database outage would.
const filing = vi.hoisted(() => ({ broken: false, calls: 0 }));
vi.mock(
  "../../apps/api/src/email-intake/ingest-email",
  async (importOriginal) => {
    const original =
      await importOriginal<
        typeof import("../../apps/api/src/email-intake/ingest-email")
      >();
    return {
      ...original,
      ingestEmail: (...args: Parameters<typeof original.ingestEmail>) => {
        filing.calls += 1;
        if (filing.broken)
          return Promise.reject(new Error("database unavailable"));
        return original.ingestEmail(...args);
      },
    };
  },
);

type User = typeof schema.userTable.$inferSelect;

const mail = (headers: string[], body: string) =>
  [...headers, "", body].join("\r\n");

const servers: Array<{ close: () => Promise<void> }> = [];
async function mailbox(messages: string[]) {
  const server = await createFakePop3Server({
    user: "intake",
    password: "fake-password",
    messages,
  });
  servers.push(server);
  vi.stubEnv("EMAIL_INTAKE_POP3_PORT", String(server.port));
  return server;
}

function turnOnMailbox() {
  vi.stubEnv("EMAIL_INTAKE_ADDRESS", "help@intake.example.test");
  vi.stubEnv("EMAIL_INTAKE_POP3_HOST", "127.0.0.1");
  vi.stubEnv("EMAIL_INTAKE_POP3_TLS", "false");
  vi.stubEnv("EMAIL_INTAKE_POP3_USER", "intake");
  vi.stubEnv("EMAIL_INTAKE_POP3_PASSWORD", "fake-password");
}

async function world() {
  const owner = await createWorkspaceMember({ role: "owner" });
  const workspaceId = owner.workspace.id;
  const { project } = await createProjectFixture({ workspaceId, slug: "help" });
  const { app } = createApp();
  const as = (user: User) => {
    mockAuthenticatedSession(user);
    return {
      get: (path: string) => app.request(`/api/email-intake${path}`),
      send: (method: string, path: string, body?: unknown) =>
        app.request(`/api/email-intake${path}`, {
          method,
          headers: { "content-type": "application/json" },
          body: body === undefined ? undefined : JSON.stringify(body),
        }),
    };
  };
  return { owner: owner.user, workspaceId, project, as, app };
}

type World = Awaited<ReturnType<typeof world>>;

async function enable(w: World) {
  const response = await w.as(w.owner).send("PUT", `/project/${w.project.id}`);
  expect(response.status).toBe(200);
  const { address } = (await response.json()) as { address: string };
  return address;
}

async function tasksOf(projectId: string) {
  return db
    .select()
    .from(schema.taskTable)
    .where(eq(schema.taskTable.projectId, projectId));
}

describe("API integration: email intake", () => {
  beforeEach(async () => {
    await resetTestDatabase();
    sentTicketReplies.length = 0;
    ticketReplyTransport.failWith = null;
    ticketReplyTransport.beforeSend = null;
    filing.broken = false;
    filing.calls = 0;
  });
  afterEach(async () => {
    vi.unstubAllEnvs();
    for (const server of servers.splice(0)) await server.close();
  });

  it("stays off without the mailbox settings and says so once in the log", async () => {
    const log = vi.spyOn(console, "log").mockImplementation(() => {});
    const w = await world();
    const server = await mailbox([]);

    const read = await w.as(w.owner).get(`/project/${w.project.id}`);
    expect(await read.json()).toEqual({
      available: false,
      repliesAvailable: false,
      address: null,
    });
    const enabled = await w.as(w.owner).send("PUT", `/project/${w.project.id}`);
    expect(enabled.status).toBe(409);

    await pollIntakeMailbox();
    await pollIntakeMailbox();
    expect(server.commands).toEqual([]);
    expect(
      log.mock.calls.filter(([line]) =>
        String(line).includes("Email intake is off"),
      ),
    ).toHaveLength(1);
  });

  it("files mail to a team address into Triage and threads replies both ways", async () => {
    turnOnMailbox();
    const w = await world();
    const address = await enable(w);
    expect(address).toMatch(/^help\+[0-9a-f]{32}@intake\.example\.test$/);
    // Turning it on again keeps the address.
    expect(await enable(w)).toBe(address);

    const unrelated = mail(
      ["From: app@example.test", "To: someone@example.test", "Subject: Reset"],
      "not for intake",
    );
    const server = await mailbox([
      mail(
        [
          'From: "Sam Requester" <sam@example.test>',
          `To: ${address}`,
          "Subject: Printer is on fire",
          "Message-ID: <first@example.test>",
        ],
        "It smokes.\r\nPlease help.",
      ),
      unrelated,
    ]);

    expect(await pollIntakeMailbox()).toMatchObject({ filed: 1 });
    await settleEvents();
    expect(server.remaining()).toEqual([unrelated]);
    const [ticket, ...others] = await tasksOf(w.project.id);
    expect(others).toHaveLength(0);
    expect(ticket).toMatchObject({
      title: "Printer is on fire",
      description: "It smokes.\nPlease help.",
      status: "triage",
      creatorId: null,
    });
    const [triage] = await db
      .select()
      .from(schema.columnTable)
      .where(
        and(
          eq(schema.columnTable.projectId, w.project.id),
          eq(schema.columnTable.slug, "triage"),
        ),
      );
    expect(ticket?.columnId).toBe(triage?.id);

    const member = await addWorkspaceMember(w.workspaceId, "member");
    const thread = await w.as(member).get(`/task/${ticket?.id}`);
    expect(await thread.json()).toEqual({
      address: "sam@example.test",
      name: "Sam Requester",
      subject: "Printer is on fire",
    });

    const reply = await w
      .as(member)
      .send("POST", `/task/${ticket?.id}/reply`, { content: "Unplug it." });
    expect(reply.status).toBe(200);
    expect(sentTicketReplies).toHaveLength(1);
    const sent = sentTicketReplies[0];
    expect(sent).toMatchObject({
      to: "sam@example.test",
      replyTo: address,
      subject: "Re: Printer is on fire",
      text: "Unplug it.",
      inReplyTo: "<first@example.test>",
      references: ["<first@example.test>"],
    });
    const [memberComment] = await db
      .select()
      .from(schema.activityTable)
      .where(
        and(
          eq(schema.activityTable.taskId, ticket?.id ?? ""),
          eq(schema.activityTable.type, "comment"),
        ),
      );
    expect(memberComment).toMatchObject({
      userId: member.id,
      content: "Unplug it.",
    });

    const answer = mail(
      [
        "From: Sam Requester <sam@example.test>",
        `To: ${address}`,
        "Subject: Re: Printer is on fire",
        "Message-ID: <second@example.test>",
        `In-Reply-To: ${sent?.messageId}`,
        `References: <first@example.test> ${sent?.messageId}`,
      ],
      "Done, thanks.\r\n\r\nOn Monday, Help wrote:\r\n> Unplug it.",
    );
    await mailbox([answer]);
    expect(await pollIntakeMailbox()).toMatchObject({ filed: 1 });
    // The same message delivered twice is filed once.
    await mailbox([answer]);
    expect(await pollIntakeMailbox()).toMatchObject({ filed: 0 });

    expect(await tasksOf(w.project.id)).toHaveLength(1);
    const comments = await db
      .select()
      .from(schema.activityTable)
      .where(
        and(
          eq(schema.activityTable.taskId, ticket?.id ?? ""),
          eq(schema.activityTable.externalSource, "email"),
        ),
      );
    expect(comments).toHaveLength(1);
    expect(comments[0]).toMatchObject({
      userId: null,
      externalUserName: "Sam Requester",
      content: "Done, thanks.",
    });

    // The next reply continues the whole thread.
    await w
      .as(member)
      .send("POST", `/task/${ticket?.id}/reply`, { content: "Great." });
    expect(sentTicketReplies[1]).toMatchObject({
      inReplyTo: "<second@example.test>",
      references: [
        "<first@example.test>",
        sent?.messageId,
        "<second@example.test>",
      ],
    });
  });

  it("files one ticket per team addressed and skips loops, strangers' addresses and turned-off teams", async () => {
    turnOnMailbox();
    const w = await world();
    const address = await enable(w);
    const { project: other } = await createProjectFixture({
      workspaceId: w.workspaceId,
      slug: "ops",
    });
    const otherAddress = (
      (await (
        await w.as(w.owner).send("PUT", `/project/${other.id}`)
      ).json()) as { address: string }
    ).address;

    const server = await mailbox([
      mail(
        [
          "From: sam@example.test",
          `To: ${address}`,
          `Cc: ${otherAddress}`,
          "Subject: Both teams",
          "Message-ID: <both@example.test>",
        ],
        "hello",
      ),
      mail(
        [
          "From: sam@example.test",
          `To: ${address}`,
          "Auto-Submitted: auto-replied",
          "Subject: Out of office",
        ],
        "away",
      ),
      mail(
        [
          "From: sam@example.test",
          "To: help+00000000000000000000000000000000@intake.example.test",
          "Subject: Nobody",
        ],
        "lost",
      ),
    ]);
    await pollIntakeMailbox();
    // All three were read: mail to a team address never waits for a retry.
    expect(server.remaining()).toEqual([]);
    expect((await tasksOf(w.project.id)).map((task) => task.title)).toEqual([
      "Both teams",
    ]);
    expect((await tasksOf(other.id)).map((task) => task.title)).toEqual([
      "Both teams",
    ]);

    const off = await w.as(w.owner).send("DELETE", `/project/${w.project.id}`);
    expect(await off.json()).toMatchObject({ address: null });
    await mailbox([
      mail(
        ["From: sam@example.test", `To: ${address}`, "Subject: After off"],
        "late",
      ),
    ]);
    await pollIntakeMailbox();
    expect(await tasksOf(w.project.id)).toHaveLength(1);
  });

  it("shows the address and its switch only to people who can change the team", async () => {
    turnOnMailbox();
    const w = await world();
    const viewer = await addWorkspaceMember(w.workspaceId, "viewer");
    const member = await addWorkspaceMember(w.workspaceId, "member");
    const outsider = await createWorkspaceMember({ role: "owner" });
    const path = `/project/${w.project.id}`;

    expect((await w.as(viewer).send("PUT", path)).status).toBe(403);
    expect((await w.as(member).send("PUT", path)).status).toBe(403);
    await enable(w);
    for (const method of ["GET", "DELETE"]) {
      expect((await w.as(viewer).send(method, path)).status).toBe(403);
      expect((await w.as(member).send(method, path)).status).toBe(403);
    }

    // A guest of the team is held to the guest limits whatever their role.
    const guest = await addWorkspaceMember(w.workspaceId, "admin");
    await restrictToProjects(w.workspaceId, guest.id, [w.project.id]);
    await db
      .update(schema.workspaceMemberAccessTable)
      .set({ guest: true })
      .where(eq(schema.workspaceMemberAccessTable.userId, guest.id));
    for (const method of ["GET", "PUT", "DELETE"])
      expect((await w.as(guest).send(method, path)).status).toBe(403);

    // Anyone kept out of the team, member or manager, is refused with the
    // answer for a team that does not exist (the repo's hidden-team rule).
    const { project: elsewhere } = await createProjectFixture({
      workspaceId: w.workspaceId,
    });
    for (const role of ["member", "admin"]) {
      const restricted = await addWorkspaceMember(w.workspaceId, role);
      await restrictToProjects(w.workspaceId, restricted.id, [elsewhere.id]);
      for (const method of ["GET", "PUT", "DELETE"]) {
        const hidden = await w.as(restricted).send(method, path);
        const unknown = await w
          .as(restricted)
          .send(method, "/project/no-such-team");
        expect(hidden.status).toBe(404);
        expect(hidden.status).toBe(unknown.status);
        expect(await hidden.json()).toEqual(await unknown.json());
      }
    }

    expect((await w.as(outsider.user).get(path)).status).toBe(404);
    expect((await w.as(outsider.user).send("PUT", path)).status).toBe(404);
    expect(await (await w.as(w.owner).get(path)).json()).toMatchObject({
      address: expect.stringMatching(/^help\+[0-9a-f]{32}@/),
    });
  });

  it("threads a reply only onto a Message-ID this server sent", async () => {
    turnOnMailbox();
    const w = await world();
    const address = await enable(w);
    await mailbox([
      mail(
        [
          "From: sam@example.test",
          `To: ${address}`,
          "Subject: Private matter",
          "Message-ID: <sams-own@example.test>",
        ],
        "secret",
      ),
    ]);
    await pollIntakeMailbox();
    const [ticket] = await tasksOf(w.project.id);

    // Someone else who learned the requester's own Message-ID.
    await mailbox([
      mail(
        [
          "From: intruder@example.test",
          `To: ${address}`,
          "Subject: Re: Private matter",
          "Message-ID: <intruder@example.test>",
          "In-Reply-To: <sams-own@example.test>",
          "References: <sams-own@example.test>",
        ],
        "let me in",
      ),
    ]);
    await pollIntakeMailbox();
    const comments = await db
      .select()
      .from(schema.activityTable)
      .where(eq(schema.activityTable.taskId, ticket?.id ?? ""));
    expect(comments.filter((row) => row.type === "comment")).toEqual([]);
    expect((await tasksOf(w.project.id)).map((task) => task.title)).toEqual(
      expect.arrayContaining(["Private matter", "Re: Private matter"]),
    );
  });

  it("deletes oversized mail unread and never files bounces", async () => {
    turnOnMailbox();
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const w = await world();
    const address = await enable(w);
    const server = await mailbox([
      mail(
        ["From: sam@example.test", `To: ${address}`, "Subject: Huge secret"],
        "x".repeat(5 * 1024 * 1024 + 1),
      ),
      mail(
        [
          "From: MAILER-DAEMON@mx.example.test",
          `To: ${address}`,
          "Subject: Undelivered Mail Returned to Sender",
        ],
        "bounce",
      ),
      mail(
        [
          "From: sam@example.test",
          "Return-Path: <>",
          `To: ${address}`,
          'Content-Type: multipart/report; report-type=delivery-status; boundary="r"',
          "Subject: Delivery Status Notification",
        ],
        "--r--",
      ),
    ]);
    await pollIntakeMailbox();
    expect(await tasksOf(w.project.id)).toEqual([]);
    expect(server.remaining()).toEqual([]);
    expect(server.commands).not.toContain("RETR 1");
    const lines = warn.mock.calls.map((call) => call.join(" "));
    expect(lines.some((line) => line.includes("over 5242880 bytes"))).toBe(
      true,
    );
    expect(lines.some((line) => line.includes("Huge secret"))).toBe(false);
  });

  it("stops retrying a message after five failed attempts", async () => {
    turnOnMailbox();
    vi.spyOn(console, "error").mockImplementation(() => {});
    const w = await world();
    const address = await enable(w);
    const server = await mailbox([
      mail(["From: sam@example.test", `To: ${address}`, "Subject: Stuck"], "x"),
    ]);
    filing.broken = true;
    for (let poll = 0; poll < 7; poll++) await pollIntakeMailbox();
    expect(filing.calls).toBe(5);
    expect(server.remaining()).toHaveLength(1);
    const [failure] = await db.select().from(emailIntakeFailureTable);
    expect(failure?.attempts).toBe(5);
    expect(await tasksOf(w.project.id)).toEqual([]);
  });

  it("records the reply as a comment before sending and withdraws it when sending fails", async () => {
    turnOnMailbox();
    const w = await world();
    const address = await enable(w);
    await mailbox([
      mail(["From: sam@example.test", `To: ${address}`, "Subject: Help"], "x"),
    ]);
    await pollIntakeMailbox();
    const [ticket] = await tasksOf(w.project.id);
    const commentsOnTicket = () =>
      db
        .select()
        .from(schema.activityTable)
        .where(
          and(
            eq(schema.activityTable.taskId, ticket?.id ?? ""),
            eq(schema.activityTable.type, "comment"),
          ),
        );
    const outbound = () =>
      db
        .select()
        .from(emailIntakeMessageTable)
        .where(eq(emailIntakeMessageTable.direction, "outbound"));

    let seenDuringSend: unknown[] = [];
    ticketReplyTransport.beforeSend = async () => {
      seenDuringSend = [
        (await commentsOnTicket()).length,
        (await outbound()).map((row) => row.status),
      ];
    };
    const ok = await w
      .as(w.owner)
      .send("POST", `/task/${ticket?.id}/reply`, { content: "On it." });
    expect(ok.status).toBe(200);
    expect(seenDuringSend).toEqual([1, ["pending"]]);
    expect((await outbound()).map((row) => row.status)).toEqual(["sent"]);

    vi.spyOn(console, "error").mockImplementation(() => {});
    ticketReplyTransport.failWith = Object.assign(new Error("rejected"), {
      code: "EENVELOPE",
    });
    const failed = await w
      .as(w.owner)
      .send("POST", `/task/${ticket?.id}/reply`, { content: "Again." });
    expect(failed.status).toBe(502);
    expect((await commentsOnTicket()).map((row) => row.content)).toEqual([
      "On it.",
    ]);
    expect((await outbound()).map((row) => row.status)).toEqual(["sent"]);
  });

  it("lets only people who can update the ticket reply, and only on emailed tickets", async () => {
    turnOnMailbox();
    const w = await world();
    const address = await enable(w);
    await mailbox([
      mail(
        ["From: sam@example.test", `To: ${address}`, "Subject: Help"],
        "please",
      ),
    ]);
    await pollIntakeMailbox();
    const [ticket] = await tasksOf(w.project.id);
    const reply = (user: User, taskId = ticket?.id) =>
      w.as(user).send("POST", `/task/${taskId}/reply`, { content: "Hi" });

    const viewer = await addWorkspaceMember(w.workspaceId, "viewer");
    expect((await w.as(viewer).get(`/task/${ticket?.id}`)).status).toBe(200);
    expect((await reply(viewer)).status).toBe(403);

    const { project: elsewhere } = await createProjectFixture({
      workspaceId: w.workspaceId,
    });
    const restricted = await addWorkspaceMember(w.workspaceId, "member");
    await restrictToProjects(w.workspaceId, restricted.id, [elsewhere.id]);
    // Same answer as the ticket's own comment list gives them.
    w.as(restricted);
    const comments = await w.app.request(`/api/comment/${ticket?.id}`);
    expect(comments.status).toBe(403);
    expect((await w.as(restricted).get(`/task/${ticket?.id}`)).status).toBe(
      403,
    );
    expect((await reply(restricted)).status).toBe(403);

    const outsider = await createWorkspaceMember({ role: "owner" });
    expect((await reply(outsider.user)).status).toBe(404);
    expect(sentTicketReplies).toHaveLength(0);

    const [plain] = await db
      .insert(schema.taskTable)
      .values({ projectId: w.project.id, title: "Typed in", number: 99 })
      .returning();
    expect((await w.as(w.owner).get(`/task/${plain?.id}`)).status).toBe(200);
    expect(await (await w.as(w.owner).get(`/task/${plain?.id}`)).json()).toBe(
      null,
    );
    expect((await reply(w.owner, plain?.id)).status).toBe(404);

    expect((await reply(w.owner)).status).toBe(200);
    await w.as(w.owner).send("DELETE", `/project/${w.project.id}`);
    expect((await reply(w.owner)).status).toBe(409);
  });
});
