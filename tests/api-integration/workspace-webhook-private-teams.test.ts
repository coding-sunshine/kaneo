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
import { createApp } from "../../apps/api/src/index";
import { mockAuthenticatedSession } from "./helpers/auth";
import { resetTestDatabase } from "./helpers/database";
import {
  createProjectFixture,
  createWorkspaceMember,
} from "./helpers/fixtures";
import { addWorkspaceMember } from "./helpers/project-access/add-workspace-member";

type User = { id: string };
type Webhook = { id: string; projectIds: string[]; hiddenProjectCount: number };

const URL = "http://127.0.0.1:9/hook";

beforeEach(async () => {
  await resetTestDatabase();
  vi.stubEnv("NOTIFICATION_SECRET_ENCRYPTION_KEY", "webhook-test-key");
  vi.stubEnv("KANEO_ALLOW_PRIVATE_WEBHOOK_DESTINATIONS", "true");
});
afterEach(() => {
  vi.unstubAllEnvs();
});

// A workspace with an open team and a private one. The admin manages the
// workspace's settings but is not in the private team.
async function setup() {
  const { user: owner, workspace } = await createWorkspaceMember({
    role: "owner",
  });
  const workspaceId = workspace.id;
  const open = await createProjectFixture({ workspaceId, name: "Open" });
  const secret = await createProjectFixture({ workspaceId, name: "Secret" });
  await db
    .update(schema.projectTable)
    .set({ isPrivate: true })
    .where(eq(schema.projectTable.id, secret.project.id));
  const admin = await addWorkspaceMember(workspaceId, "admin");
  const { app } = createApp();
  const as = (user: User) => (method: string, path: string, body?: unknown) => {
    mockAuthenticatedSession(user as never);
    return app.request(`/api/workspace-webhook${path}`, {
      method,
      headers: { "content-type": "application/json" },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
  };
  const create = async (projectIds: string[]) => {
    const res = await as(owner)("POST", "", {
      workspaceId,
      label: "hook",
      url: URL,
      resourceTypes: ["task"],
      projectIds,
    });
    expect(res.status, await res.clone().text()).toBe(200);
    return ((await res.json()) as { webhook: Webhook }).webhook;
  };
  const stored = async (id: string) => {
    const [row] = await db
      .select({ projectIds: schema.workspaceWebhookTable.projectIds })
      .from(schema.workspaceWebhookTable)
      .where(eq(schema.workspaceWebhookTable.id, id));
    return [...(row?.projectIds ?? [])].sort();
  };
  return {
    workspaceId,
    owner,
    admin,
    openId: open.project.id,
    secretId: secret.project.id,
    as,
    create,
    stored,
  };
}

describe("workspace webhooks and private teams", () => {
  it("lists only the teams the caller can open, and counts the rest", async () => {
    const { workspaceId, owner, admin, openId, secretId, as, create } =
      await setup();
    const both = await create([openId, secretId]);
    const onlySecret = await create([secretId]);

    const listed = await as(admin)("GET", `/workspace/${workspaceId}`);
    expect(listed.status).toBe(200);
    const text = await listed.text();
    expect(text).not.toContain(secretId);
    expect(JSON.parse(text)).toEqual([
      expect.objectContaining({
        id: both.id,
        projectIds: [openId],
        hiddenProjectCount: 1,
      }),
      expect.objectContaining({
        id: onlySecret.id,
        projectIds: [],
        hiddenProjectCount: 1,
      }),
    ]);

    const byOwner = (await (
      await as(owner)("GET", `/workspace/${workspaceId}`)
    ).json()) as Webhook[];
    expect(byOwner.map((hook) => hook.hiddenProjectCount)).toEqual([0, 0]);
    expect([...(byOwner[0]?.projectIds ?? [])].sort()).toEqual(
      [openId, secretId].sort(),
    );
  });

  it("keeps the hidden teams when the admin saves the teams they can see", async () => {
    const { admin, openId, secretId, as, create, stored } = await setup();
    const hook = await create([openId, secretId]);

    const saved = await as(admin)("PUT", `/${hook.id}`, {
      label: "renamed",
      projectIds: [openId],
    });
    expect(saved.status).toBe(200);
    const text = await saved.text();
    expect(text).not.toContain(secretId);
    expect(JSON.parse(text)).toMatchObject({
      projectIds: [openId],
      hiddenProjectCount: 1,
    });
    expect(await stored(hook.id)).toEqual([openId, secretId].sort());

    // Clearing the teams they can see leaves the hidden one.
    const cleared = await as(admin)("PUT", `/${hook.id}`, { projectIds: [] });
    expect(cleared.status).toBe(200);
    expect(await stored(hook.id)).toEqual([secretId]);
  });

  it("does not count a deleted team as hidden, and drops it on save", async () => {
    const { workspaceId, owner, openId, as, create, stored } = await setup();
    const gone = await createProjectFixture({ workspaceId, name: "Gone" });
    const hook = await create([openId, gone.project.id]);
    await db
      .delete(schema.projectTable)
      .where(eq(schema.projectTable.id, gone.project.id));

    const [listed] = (await (
      await as(owner)("GET", `/workspace/${workspaceId}`)
    ).json()) as Webhook[];
    expect(listed).toMatchObject({
      projectIds: [openId],
      hiddenProjectCount: 0,
    });

    const saved = await as(owner)("PUT", `/${hook.id}`, {
      projectIds: [openId],
    });
    expect(saved.status).toBe(200);
    expect(await stored(hook.id)).toEqual([openId]);
  });

  it("answers a private team the admin cannot open like an unknown one", async () => {
    const { workspaceId, admin, openId, secretId, as, create } = await setup();
    const body = (projectIds: string[]) => ({
      workspaceId,
      label: "hook",
      url: URL,
      resourceTypes: ["task"],
      projectIds,
    });
    const unknown = await as(admin)("POST", "", body(["no-such-team"]));
    expect(unknown.status).toBe(400);
    const hidden = await as(admin)("POST", "", body([secretId]));
    expect(hidden.status).toBe(400);
    expect(await hidden.json()).toEqual(await unknown.json());

    const hook = await create([openId]);
    const updated = await as(admin)("PUT", `/${hook.id}`, {
      projectIds: [openId, secretId],
    });
    expect(updated.status).toBe(400);
  });
});
