import { randomUUID } from "node:crypto";
import { eq } from "drizzle-orm";
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
  FIGMA_FAILURE_TTL_MS,
  FIGMA_LOOKUP_LIMIT,
  FIGMA_THUMBNAIL_TTL_MS,
} from "../../apps/api/src/figma/figma-limits";
import { createApp } from "../../apps/api/src/index";
import { mockAnonymousSession, mockAuthenticatedSession } from "./helpers/auth";
import { resetTestDatabase } from "./helpers/database";
import {
  createProjectFixture,
  createWorkspaceMember,
} from "./helpers/fixtures";

// A fake of the Figma REST API: no test talks to api.figma.com.
const figma = vi.hoisted(() => ({ fetchFigmaFile: vi.fn() }));
vi.mock("../../apps/api/src/figma/figma-api", () => figma);

const { app } = createApp();
const KEY = "AbCdEf0123456789xyzQrs";
const FRAME_URL = `https://www.figma.com/design/${KEY}/Checkout?node-id=12-34`;
const TOKEN = "figd_fake_token_value";

const okFile = (fileName: string) => ({
  status: "ok",
  file: {
    fileName,
    frameName: "Payment step",
    thumbnailUrl: "https://figma-cdn.test/frame.png",
  },
});

function getPreview(workspaceId: string, url = FRAME_URL) {
  const query = new URLSearchParams({ workspaceId, url });
  return app.request(`/api/figma/preview?${query}`);
}

function refreshPreview(workspaceId: string, url = FRAME_URL) {
  return app.request("/api/figma/preview/refresh", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ workspaceId, url }),
  });
}

async function addTask(
  projectId: string,
  description: string,
  number = Math.floor(Math.random() * 1_000_000),
) {
  const [task] = await db
    .insert(schema.taskTable)
    .values({ projectId, title: "Design", description, number })
    .returning();
  if (!task) throw new Error("task not seeded");
  return task;
}

async function addMember(workspaceId: string, role = "member") {
  const [user] = await db
    .insert(schema.userTable)
    .values({
      id: `user-${randomUUID()}`,
      email: `${randomUUID()}@example.com`,
      emailVerified: true,
      name: "Teammate",
    })
    .returning();
  if (!user) throw new Error("user not seeded");
  await db
    .insert(schema.workspaceUserTable)
    .values({ workspaceId, userId: user.id, role, joinedAt: new Date() });
  return user;
}

/** A signed-in member whose workspace has a task that links the frame. */
async function memberWithLink(description = `Spec: ${FRAME_URL}`) {
  const { user, workspace } = await createWorkspaceMember();
  const { project } = await createProjectFixture({
    workspaceId: workspace.id,
  });
  const task = await addTask(project.id, description);
  mockAuthenticatedSession(user);
  return { user, workspace, project, task };
}

beforeEach(async () => {
  await resetTestDatabase();
  figma.fetchFigmaFile.mockReset();
  figma.fetchFigmaFile.mockResolvedValue(okFile("Checkout flow"));
  process.env.FIGMA_ACCESS_TOKEN = TOKEN;
});

afterEach(() => {
  vi.useRealTimers();
  delete process.env.FIGMA_ACCESS_TOKEN;
});

describe("figma previews: config", () => {
  it("says previews are on only with a token", async () => {
    const on = await (await app.request("/api/config")).json();
    expect(on.hasFigmaPreviews).toBe(true);
    delete process.env.FIGMA_ACCESS_TOKEN;
    const off = await (await app.request("/api/config")).json();
    expect(off.hasFigmaPreviews).toBe(false);
  });
});

describe("GET /figma/preview", () => {
  it("fetches a frame once, then serves the stored card", async () => {
    const { workspace } = await memberWithLink();

    const first = await getPreview(workspace.id);
    expect(first.status).toBe(200);
    const card = await first.json();
    expect(card).toMatchObject({
      url: FRAME_URL,
      fileName: "Checkout flow",
      frameName: "Payment step",
      thumbnailUrl: "https://figma-cdn.test/frame.png",
    });
    expect(Number.isNaN(Date.parse(card.fetchedAt))).toBe(false);
    expect(figma.fetchFigmaFile).toHaveBeenCalledWith(
      { fileKey: KEY, nodeId: "12:34" },
      { token: TOKEN },
    );
    expect(JSON.stringify(card)).not.toContain(TOKEN);

    figma.fetchFigmaFile.mockResolvedValue(okFile("Renamed"));
    const second = await (await getPreview(workspace.id)).json();
    expect(second.fileName).toBe("Checkout flow");
    expect(second.fetchedAt).toBe(card.fetchedAt);
    expect(figma.fetchFigmaFile).toHaveBeenCalledTimes(1);
  });

  it("does not serve one workspace's stored card to another", async () => {
    const a = await memberWithLink();
    await getPreview(a.workspace.id);

    const b = await memberWithLink();
    figma.fetchFigmaFile.mockResolvedValue(okFile("Seen by B"));
    const card = await (await getPreview(b.workspace.id)).json();
    expect(card.fileName).toBe("Seen by B");
    expect(figma.fetchFigmaFile).toHaveBeenCalledTimes(2);
  });

  it("rejects a link that is not a figma.com design link", async () => {
    const { workspace } = await memberWithLink();
    const response = await getPreview(
      workspace.id,
      `https://figma.com.evil.test/design/${KEY}`,
    );
    expect(response.status).toBe(400);
    expect(figma.fetchFigmaFile).not.toHaveBeenCalled();
  });

  it("answers 404 when the token cannot open the file", async () => {
    const { workspace } = await memberWithLink();
    figma.fetchFigmaFile.mockResolvedValue({ status: "not_found" });
    expect((await getPreview(workspace.id)).status).toBe(404);
  });

  it("answers 502 when Figma fails, and stores nothing", async () => {
    const { workspace } = await memberWithLink();
    figma.fetchFigmaFile.mockResolvedValue({ status: "failed" });
    expect((await getPreview(workspace.id)).status).toBe(502);
    const stored = await db.select().from(schema.figmaLinkPreviewTable);
    expect(stored).toHaveLength(0);
  });

  it("is off without a token and never calls Figma", async () => {
    const { workspace } = await memberWithLink();
    delete process.env.FIGMA_ACCESS_TOKEN;
    expect((await getPreview(workspace.id)).status).toBe(404);
    expect((await refreshPreview(workspace.id)).status).toBe(404);
    expect(figma.fetchFigmaFile).not.toHaveBeenCalled();
  });

  it("requires a signed-in session", async () => {
    const { workspace } = await memberWithLink();
    mockAnonymousSession();
    expect((await getPreview(workspace.id)).status).toBe(401);
  });

  it("hides the workspace from someone outside it", async () => {
    const { workspace } = await memberWithLink();
    const outsider = await createWorkspaceMember();
    mockAuthenticatedSession(outsider.user);
    // Same answer as a workspace that does not exist.
    expect((await getPreview(workspace.id)).status).toBe(404);
    expect(figma.fetchFigmaFile).not.toHaveBeenCalled();
  });
});

describe("figma previews: only files linked where the caller can read", () => {
  it("serves a file linked in a comment", async () => {
    const { user, workspace, project } = await memberWithLink("No link here");
    const task = await addTask(project.id, "Still no link");
    await db.insert(schema.activityTable).values({
      taskId: task.id,
      type: "comment",
      userId: user.id,
      content: `Latest frame: [link](${FRAME_URL})`,
    });
    expect((await getPreview(workspace.id)).status).toBe(200);
  });

  it("serves a file linked in a workspace document someone else wrote", async () => {
    const { workspace } = await memberWithLink("No link here");
    const author = await addMember(workspace.id);
    await db.insert(schema.documentTable).values({
      workspaceId: workspace.id,
      creatorId: author.id,
      scope: "workspace",
      title: "Design notes",
      content: `See ${FRAME_URL}`,
    });
    expect((await getPreview(workspace.id)).status).toBe(200);
  });

  it("answers 404 for a file nobody linked, without calling Figma", async () => {
    const { workspace } = await memberWithLink("No link here");
    expect((await getPreview(workspace.id)).status).toBe(404);
    expect((await refreshPreview(workspace.id)).status).toBe(404);
    expect(figma.fetchFigmaFile).not.toHaveBeenCalled();
  });

  it("answers 404 when the link is only in a private document of someone else", async () => {
    const { workspace } = await memberWithLink("No link here");
    const author = await addMember(workspace.id);
    await db.insert(schema.documentTable).values({
      workspaceId: workspace.id,
      creatorId: author.id,
      scope: "private",
      content: `See ${FRAME_URL}`,
    });
    expect((await getPreview(workspace.id)).status).toBe(404);
    expect(figma.fetchFigmaFile).not.toHaveBeenCalled();
  });

  it("answers 404 when the link is only in a private team the caller cannot open", async () => {
    const { workspace } = await createWorkspaceMember({ role: "owner" });
    const { project } = await createProjectFixture({
      workspaceId: workspace.id,
    });
    await db
      .update(schema.projectTable)
      .set({ isPrivate: true })
      .where(eq(schema.projectTable.id, project.id));
    await addTask(project.id, `Spec: ${FRAME_URL}`);
    const member = await addMember(workspace.id);
    mockAuthenticatedSession(member);
    expect((await getPreview(workspace.id)).status).toBe(404);
    expect(figma.fetchFigmaFile).not.toHaveBeenCalled();
  });

  it("answers 404 when the link is only in another workspace", async () => {
    await memberWithLink();
    const other = await createWorkspaceMember();
    mockAuthenticatedSession(other.user);
    expect((await getPreview(other.workspace.id)).status).toBe(404);
    expect(figma.fetchFigmaFile).not.toHaveBeenCalled();
  });

  it("stops serving a stored card once the link is gone", async () => {
    const { workspace, task } = await memberWithLink();
    expect((await getPreview(workspace.id)).status).toBe(200);
    await db
      .update(schema.taskTable)
      .set({ description: "Removed the link" })
      .where(eq(schema.taskTable.id, task.id));
    expect((await getPreview(workspace.id)).status).toBe(404);
  });
});

describe("figma previews: lookup limits", () => {
  it(`caps a person at ${FIGMA_LOOKUP_LIMIT} Figma lookups, then answers 429`, async () => {
    const keys = Array.from(
      { length: FIGMA_LOOKUP_LIMIT + 1 },
      (_, i) => `LimitKey${String(i).padStart(4, "0")}abcdef`,
    );
    const urls = keys.map((key) => `https://www.figma.com/design/${key}/F`);
    const { workspace } = await memberWithLink(urls.join("\n"));

    for (const url of urls.slice(0, FIGMA_LOOKUP_LIMIT))
      expect((await getPreview(workspace.id, url)).status).toBe(200);
    const limited = await getPreview(workspace.id, urls.at(-1));
    expect(limited.status).toBe(429);
    expect(Number(limited.headers.get("retry-after"))).toBeGreaterThan(0);
    expect(figma.fetchFigmaFile).toHaveBeenCalledTimes(FIGMA_LOOKUP_LIMIT);

    // Stored cards do not count against the cap.
    expect((await getPreview(workspace.id, urls[0])).status).toBe(200);
    expect((await refreshPreview(workspace.id, urls[0])).status).toBe(429);
  });

  it("remembers a failed lookup for a while instead of asking Figma again", async () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date("2026-01-01T10:00:00Z"));
    const { workspace } = await memberWithLink();
    figma.fetchFigmaFile.mockResolvedValue({ status: "not_found" });
    expect((await getPreview(workspace.id)).status).toBe(404);
    expect((await getPreview(workspace.id)).status).toBe(404);
    expect((await refreshPreview(workspace.id)).status).toBe(404);
    expect(figma.fetchFigmaFile).toHaveBeenCalledTimes(1);

    vi.setSystemTime(Date.now() + FIGMA_FAILURE_TTL_MS + 1000);
    figma.fetchFigmaFile.mockResolvedValue(okFile("Shared now"));
    expect((await getPreview(workspace.id)).status).toBe(200);
    expect(figma.fetchFigmaFile).toHaveBeenCalledTimes(2);
  });

  it("remembers an outage per workspace, not across workspaces", async () => {
    const a = await memberWithLink();
    figma.fetchFigmaFile.mockResolvedValue({ status: "failed" });
    expect((await getPreview(a.workspace.id)).status).toBe(502);
    expect((await getPreview(a.workspace.id)).status).toBe(502);
    expect(figma.fetchFigmaFile).toHaveBeenCalledTimes(1);

    const b = await memberWithLink();
    figma.fetchFigmaFile.mockResolvedValue(okFile("Checkout flow"));
    expect((await getPreview(b.workspace.id)).status).toBe(200);
  });
});

describe("figma previews: expiring thumbnails", () => {
  it("reads Figma again once the stored image link has expired", async () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date("2026-01-01T10:00:00Z"));
    const { workspace } = await memberWithLink();
    await getPreview(workspace.id);

    vi.setSystemTime(Date.now() + FIGMA_THUMBNAIL_TTL_MS + 1000);
    figma.fetchFigmaFile.mockResolvedValue(okFile("Checkout flow v3"));
    const card = await (await getPreview(workspace.id)).json();
    expect(card.fileName).toBe("Checkout flow v3");
    expect(card.thumbnailUrl).toBe("https://figma-cdn.test/frame.png");
    expect(Date.parse(card.fetchedAt)).toBe(Date.now());
  });

  it("drops an expired image when Figma cannot be read again", async () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date("2026-01-01T10:00:00Z"));
    const { workspace } = await memberWithLink();
    await getPreview(workspace.id);

    vi.setSystemTime(Date.now() + FIGMA_THUMBNAIL_TTL_MS + 1000);
    figma.fetchFigmaFile.mockResolvedValue({ status: "failed" });
    const response = await getPreview(workspace.id);
    expect(response.status).toBe(200);
    const card = await response.json();
    expect(card.fileName).toBe("Checkout flow");
    expect(card.thumbnailUrl).toBeNull();
  });
});

describe("POST /figma/preview/refresh", () => {
  it("fetches again and moves the fetched-at time", async () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date("2026-01-01T10:00:00Z"));
    const { workspace } = await memberWithLink();
    const before = await (await getPreview(workspace.id)).json();

    vi.setSystemTime(new Date("2026-01-01T11:00:00Z"));
    figma.fetchFigmaFile.mockResolvedValue(okFile("Checkout flow v2"));
    const response = await refreshPreview(workspace.id);
    expect(response.status).toBe(200);
    const after = await response.json();
    expect(after.fileName).toBe("Checkout flow v2");
    expect(Date.parse(after.fetchedAt)).toBeGreaterThan(
      Date.parse(before.fetchedAt),
    );

    const served = await (await getPreview(workspace.id)).json();
    expect(served.fileName).toBe("Checkout flow v2");
  });

  it("keeps the stored card when Figma fails", async () => {
    const { workspace } = await memberWithLink();
    await getPreview(workspace.id);
    figma.fetchFigmaFile.mockResolvedValue({ status: "failed" });
    expect((await refreshPreview(workspace.id)).status).toBe(502);
    const served = await (await getPreview(workspace.id)).json();
    expect(served.fileName).toBe("Checkout flow");
  });

  it("requires a signed-in session", async () => {
    const { workspace } = await memberWithLink();
    mockAnonymousSession();
    expect((await refreshPreview(workspace.id)).status).toBe(401);
  });

  it("hides the workspace from someone outside it", async () => {
    const { workspace } = await memberWithLink();
    const outsider = await createWorkspaceMember();
    mockAuthenticatedSession(outsider.user);
    expect((await refreshPreview(workspace.id)).status).toBe(404);
    expect(figma.fetchFigmaFile).not.toHaveBeenCalled();
  });
});

describe("figma previews: roles", () => {
  it("answers 404 to a guest on both routes, even for a linked file", async () => {
    const { user, workspace } = await memberWithLink();
    await db.insert(schema.workspaceMemberAccessTable).values({
      workspaceId: workspace.id,
      userId: user.id,
      projectAccess: "all",
      guest: true,
    });
    expect((await getPreview(workspace.id)).status).toBe(404);
    expect((await refreshPreview(workspace.id)).status).toBe(404);
    expect(figma.fetchFigmaFile).not.toHaveBeenCalled();
  });

  it("refuses a custom role without workspace:read", async () => {
    const { user, workspace } = await createWorkspaceMember({
      role: "taskonly",
    });
    await db.insert(schema.workspaceRoleTable).values({
      workspaceId: workspace.id,
      role: "taskonly",
      permission: JSON.stringify({ task: ["read"], project: ["read"] }),
    });
    mockAuthenticatedSession(user);
    expect((await getPreview(workspace.id)).status).toBe(403);
    expect((await refreshPreview(workspace.id)).status).toBe(403);
    expect(figma.fetchFigmaFile).not.toHaveBeenCalled();
  });
});
