import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "vite-plus/test";
import db, { schema } from "../../apps/api/src/database";
import { createApp } from "../../apps/api/src/index";
import { mockAnonymousSession, mockAuthenticatedSession } from "./helpers/auth";
import { resetTestDatabase } from "./helpers/database";
import { createWorkspaceMember } from "./helpers/fixtures";

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
    const { user, workspace } = await createWorkspaceMember();
    mockAuthenticatedSession(user);

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
    const a = await createWorkspaceMember();
    mockAuthenticatedSession(a.user);
    await getPreview(a.workspace.id);

    const b = await createWorkspaceMember();
    mockAuthenticatedSession(b.user);
    figma.fetchFigmaFile.mockResolvedValue(okFile("Seen by B"));
    const card = await (await getPreview(b.workspace.id)).json();
    expect(card.fileName).toBe("Seen by B");
    expect(figma.fetchFigmaFile).toHaveBeenCalledTimes(2);
  });

  it("rejects a link that is not a figma.com design link", async () => {
    const { user, workspace } = await createWorkspaceMember();
    mockAuthenticatedSession(user);
    const response = await getPreview(
      workspace.id,
      `https://figma.com.evil.test/design/${KEY}`,
    );
    expect(response.status).toBe(400);
    expect(figma.fetchFigmaFile).not.toHaveBeenCalled();
  });

  it("answers 404 when the token cannot open the file", async () => {
    const { user, workspace } = await createWorkspaceMember();
    mockAuthenticatedSession(user);
    figma.fetchFigmaFile.mockResolvedValue({ status: "not_found" });
    expect((await getPreview(workspace.id)).status).toBe(404);
  });

  it("answers 502 when Figma fails, and stores nothing", async () => {
    const { user, workspace } = await createWorkspaceMember();
    mockAuthenticatedSession(user);
    figma.fetchFigmaFile.mockResolvedValue({ status: "failed" });
    expect((await getPreview(workspace.id)).status).toBe(502);
    figma.fetchFigmaFile.mockResolvedValue(okFile("Checkout flow"));
    expect((await getPreview(workspace.id)).status).toBe(200);
  });

  it("is off without a token and never calls Figma", async () => {
    const { user, workspace } = await createWorkspaceMember();
    mockAuthenticatedSession(user);
    delete process.env.FIGMA_ACCESS_TOKEN;
    expect((await getPreview(workspace.id)).status).toBe(404);
    expect((await refreshPreview(workspace.id)).status).toBe(404);
    expect(figma.fetchFigmaFile).not.toHaveBeenCalled();
  });

  it("requires a signed-in session", async () => {
    const { workspace } = await createWorkspaceMember();
    mockAnonymousSession();
    expect((await getPreview(workspace.id)).status).toBe(401);
  });

  it("hides the workspace from someone outside it", async () => {
    const { workspace } = await createWorkspaceMember();
    const outsider = await createWorkspaceMember();
    mockAuthenticatedSession(outsider.user);
    // Same answer as a workspace that does not exist.
    expect((await getPreview(workspace.id)).status).toBe(404);
    expect(figma.fetchFigmaFile).not.toHaveBeenCalled();
  });
});

describe("POST /figma/preview/refresh", () => {
  it("fetches again and moves the fetched-at time", async () => {
    const { user, workspace } = await createWorkspaceMember();
    mockAuthenticatedSession(user);
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date("2026-01-01T10:00:00Z"));
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
    const { user, workspace } = await createWorkspaceMember();
    mockAuthenticatedSession(user);
    await getPreview(workspace.id);
    figma.fetchFigmaFile.mockResolvedValue({ status: "failed" });
    expect((await refreshPreview(workspace.id)).status).toBe(502);
    const served = await (await getPreview(workspace.id)).json();
    expect(served.fileName).toBe("Checkout flow");
  });

  it("requires a signed-in session", async () => {
    const { workspace } = await createWorkspaceMember();
    mockAnonymousSession();
    expect((await refreshPreview(workspace.id)).status).toBe(401);
  });

  it("hides the workspace from someone outside it", async () => {
    const { workspace } = await createWorkspaceMember();
    const outsider = await createWorkspaceMember();
    mockAuthenticatedSession(outsider.user);
    expect((await refreshPreview(workspace.id)).status).toBe(404);
    expect(figma.fetchFigmaFile).not.toHaveBeenCalled();
  });
});

describe("figma previews: roles", () => {
  it("lets a guest read and refresh cards, like any reader", async () => {
    const { user, workspace } = await createWorkspaceMember();
    await db.insert(schema.workspaceMemberAccessTable).values({
      workspaceId: workspace.id,
      userId: user.id,
      projectAccess: "selected",
      guest: true,
    });
    mockAuthenticatedSession(user);
    expect((await getPreview(workspace.id)).status).toBe(200);
    expect((await refreshPreview(workspace.id)).status).toBe(200);
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
