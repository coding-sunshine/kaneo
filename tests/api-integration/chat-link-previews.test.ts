import { beforeEach, describe, expect, it, vi } from "vite-plus/test";
import db, { schema } from "../../apps/api/src/database";
import { settleEvents, subscribeToEvent } from "../../apps/api/src/events";
import { createApp } from "../../apps/api/src/index";
import { mockAuthenticatedSession } from "./helpers/auth";
import { resetTestDatabase } from "./helpers/database";
import { createWorkspaceMember } from "./helpers/fixtures";

// The outside site is faked; literal public addresses skip DNS.
const SITE = "https://93.184.216.34/";
const { siteFetch } = vi.hoisted(() => ({
  siteFetch: vi.fn(
    async () =>
      new Response(
        "<title>Example Domain</title><p>For documentation examples.</p>",
        { headers: { "content-type": "text/html" } },
      ),
  ),
}));
vi.mock("../../apps/api/src/chat/link-preview/preview-fetch", () => ({
  previewFetch: siteFetch,
}));

const updates: string[] = [];
subscribeToEvent<{ messageId: string }>(
  "chat.message_updated",
  async ({ messageId }) => {
    updates.push(messageId);
  },
);

const json = (method: string, body?: unknown) => ({
  method,
  headers: { "content-type": "application/json" },
  body: body === undefined ? undefined : JSON.stringify(body),
});

type Seeded = Awaited<ReturnType<typeof createWorkspaceMember>>;

async function setup() {
  const owner = await createWorkspaceMember({ role: "owner" });
  const teammate = await createWorkspaceMember();
  const viewer = await createWorkspaceMember();
  const outsider = await createWorkspaceMember();
  const ws = owner.workspace.id;
  for (const [member, role] of [
    [teammate, "member"],
    [viewer, "viewer"],
  ] as const)
    await db.insert(schema.workspaceUserTable).values({
      workspaceId: ws,
      userId: member.user.id,
      role,
      joinedAt: new Date(),
    });
  const { app } = createApp();
  const base = `/api/chat/workspace/${ws}/channels`;
  const as = (member: Seeded) => {
    mockAuthenticatedSession(member.user);
    return (path: string, init?: RequestInit) => app.request(path, init);
  };
  const asOwner = as(owner);
  const pub = await (
    await asOwner(base, json("POST", { name: "general" }))
  ).json();
  const priv = await (
    await asOwner(base, json("POST", { name: "leads", isPrivate: true }))
  ).json();
  const post = async (channelId: string, body: string) => {
    const response = await as(owner)(
      `${base}/${channelId}/messages`,
      json("POST", { body }),
    );
    expect(response.status).toBe(200);
    const message = await response.json();
    await settleEvents();
    return message as { id: string };
  };
  const messages = async (channelId: string) =>
    (await (await as(owner)(`${base}/${channelId}/messages`)).json()) as {
      id: string;
      linkPreview: unknown;
    }[];
  return {
    owner,
    teammate,
    viewer,
    outsider,
    base,
    as,
    pub,
    priv,
    post,
    messages,
  };
}

describe("API integration: chat link previews", () => {
  beforeEach(async () => {
    await resetTestDatabase();
    siteFetch.mockClear();
    updates.length = 0;
  });

  it("attaches a card with the page title and description", async () => {
    const { pub, post, messages } = await setup();
    const message = await post(pub.id, `look at ${SITE}`);

    const [listed] = await messages(pub.id);
    expect(listed?.linkPreview).toEqual({
      url: SITE,
      title: "Example Domain",
      description: "For documentation examples.",
      siteName: "93.184.216.34",
    });
    expect(updates).toEqual([message.id]);
  });

  it("blocks links to localhost and private networks and logs it", async () => {
    const { pub, post, messages } = await setup();
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const links = [
      "http://localhost:1337/api",
      "http://127.0.0.1/",
      "http://10.1.2.3/",
      "http://192.168.0.1/",
    ];
    for (const link of links) await post(pub.id, link);

    expect(siteFetch).not.toHaveBeenCalled();
    expect((await messages(pub.id)).map((m) => m.linkPreview)).toEqual(
      links.map(() => null),
    );
    const logged = warn.mock.calls.map((call) => String(call[0]));
    expect(logged).toHaveLength(links.length);
    for (const line of logged) {
      expect(line).toContain("Link preview blocked");
      for (const link of links) expect(line).not.toContain(link);
    }
    warn.mockRestore();
  });

  it("shows no preview for a link inside a code block", async () => {
    const { pub, post, messages } = await setup();
    await post(pub.id, `\`\`\`\ncurl ${SITE}\n\`\`\``);
    await post(pub.id, `run \`curl ${SITE}\``);

    expect(siteFetch).not.toHaveBeenCalled();
    expect((await messages(pub.id)).map((m) => m.linkPreview)).toEqual([
      null,
      null,
    ]);
  });

  it("lets the author remove the preview", async () => {
    const { owner, base, as, pub, post, messages } = await setup();
    const message = await post(pub.id, SITE);
    updates.length = 0;

    const response = await as(owner)(
      `${base}/${pub.id}/messages/${message.id}/preview`,
      { method: "DELETE" },
    );
    expect(response.status).toBe(200);
    expect((await response.json()).linkPreview).toBeNull();
    const [listed] = await messages(pub.id);
    expect(listed?.linkPreview).toBeNull();
    await settleEvents();
    expect(updates).toEqual([message.id]);
  });

  it("keeps preview removal to the author", async () => {
    const { teammate, viewer, outsider, base, as, pub, post, messages } =
      await setup();
    const message = await post(pub.id, SITE);
    const remove = (member: Seeded) =>
      as(member)(`${base}/${pub.id}/messages/${message.id}/preview`, {
        method: "DELETE",
      });

    expect((await remove(teammate)).status).toBe(403);
    expect((await remove(viewer)).status).toBe(403);
    expect((await remove(outsider)).status).toBe(404);
    expect((await messages(pub.id))[0]?.linkPreview).not.toBeNull();
  });

  it("hides private channel messages from non-members", async () => {
    const { teammate, base, as, priv, post } = await setup();
    const message = await post(priv.id, SITE);

    const response = await as(teammate)(
      `${base}/${priv.id}/messages/${message.id}/preview`,
      { method: "DELETE" },
    );
    expect(response.status).toBe(404);
  });

  it("answers 404 for a message from another channel", async () => {
    const { owner, base, as, pub, priv, post } = await setup();
    const message = await post(priv.id, SITE);

    const response = await as(owner)(
      `${base}/${pub.id}/messages/${message.id}/preview`,
      { method: "DELETE" },
    );
    expect(response.status).toBe(404);
  });
});
