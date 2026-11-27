import { eq } from "drizzle-orm";
import { beforeEach, describe, expect, it } from "vite-plus/test";
import { auth } from "../../apps/api/src/auth";
import db, { schema } from "../../apps/api/src/database";
import { createApp } from "../../apps/api/src/index";
import { signUpWithSession } from "./helpers/auth-session";
import { resetTestDatabase } from "./helpers/database";
import { createProjectFixture } from "./helpers/fixtures";
import { restrictToProjects } from "./helpers/project-access/restrict-to-projects";

type App = ReturnType<typeof createApp>["app"];

type Profile = {
  jobTitle: string | null;
  department: string | null;
  location: string | null;
  timeZone: string | null;
  status: { text: string; clearsAt: string | null } | null;
  outOfOffice: { from: string; until: string } | null;
};
type Member = { id: string; name: string; email: string; profile: Profile };

const DAY = 24 * 60 * 60 * 1000;
const inDays = (days: number) =>
  new Date(Date.now() + days * DAY).toISOString();

let app: App;

const call = (
  headers: Record<string, string>,
  path: string,
  init: { method?: string; body?: unknown } = {},
) =>
  app.request(`/api${path}`, {
    method: init.method ?? "GET",
    headers: {
      "content-type": "application/json",
      origin: "http://localhost:5173",
      ...headers,
    },
    body: init.body === undefined ? undefined : JSON.stringify(init.body),
  });

async function person(email: string, name: string) {
  const signed = await signUpWithSession(app, { email, name });
  const as = (path: string, init?: { method?: string; body?: unknown }) =>
    call({ cookie: signed.cookies }, path, init);
  return { ...signed, as };
}

async function workspaceOf(
  owner: Awaited<ReturnType<typeof person>>,
  slug: string,
) {
  const created = await owner.as("/auth/organization/create", {
    method: "POST",
    body: { name: slug, slug },
  });
  expect(created.status).toBe(200);
  return ((await created.json()) as { id: string }).id;
}

async function join(workspaceId: string, userId: string) {
  await db.insert(schema.workspaceUserTable).values({
    workspaceId,
    userId,
    role: "member",
    joinedAt: new Date(),
  });
}

const membersOf = async (
  viewer: Awaited<ReturnType<typeof person>>,
  workspaceId: string,
) => {
  const response = await viewer.as(`/workspace/${workspaceId}/members`);
  expect(response.status).toBe(200);
  return (await response.json()) as Member[];
};

describe("API integration: people profile and status", () => {
  beforeEach(async () => {
    await resetTestDatabase();
    ({ app } = createApp());
  });

  it("saves my profile, status and out-of-office range and shows them to teammates", async () => {
    const me = await person("me@example.test", "Me");
    const mate = await person("mate@example.test", "Mate");
    const workspaceId = await workspaceOf(me, "acme");
    await join(workspaceId, mate.userId);
    const from = inDays(3);
    const until = inDays(8);

    const saved = await me.as("/user/profile", {
      method: "PATCH",
      body: {
        jobTitle: "  Platform engineer ",
        department: "",
        timeZone: "Australia/Sydney",
        status: { text: "In a meeting" },
        outOfOffice: { from, until },
      },
    });
    expect(saved.status, await saved.clone().text()).toBe(200);
    const profile = (await saved.json()) as Profile;
    expect(profile).toEqual({
      jobTitle: "Platform engineer",
      department: null,
      location: null,
      timeZone: "Australia/Sydney",
      // A status set with a range clears itself when the range ends.
      status: { text: "In a meeting", clearsAt: until },
      outOfOffice: { from, until },
    });

    const own = await me.as("/user/profile");
    expect(await own.json()).toEqual(profile);

    const seen = (await membersOf(mate, workspaceId)).find(
      (member) => member.id === me.userId,
    );
    expect(seen?.profile).toEqual(profile);

    // Leaving a field out keeps it; null clears it.
    await me.as("/user/profile", {
      method: "PATCH",
      body: { location: "Remote", status: null },
    });
    const after = (await (await me.as("/user/profile")).json()) as Profile;
    expect(after.jobTitle).toBe("Platform engineer");
    expect(after.location).toBe("Remote");
    expect(after.status).toBeNull();
    expect(after.outOfOffice).toEqual({ from, until });
  });

  it("hides a status and a range once they have ended", async () => {
    const me = await person("me@example.test", "Me");
    const workspaceId = await workspaceOf(me, "acme");

    const saved = await me.as("/user/profile", {
      method: "PATCH",
      body: {
        status: { text: "Travelling", clearsAt: inDays(-1) },
        outOfOffice: { from: inDays(-5), until: inDays(-1) },
      },
    });
    expect(saved.status).toBe(200);

    const profile = (await (await me.as("/user/profile")).json()) as Profile;
    expect(profile.status).toBeNull();
    expect(profile.outOfOffice).toBeNull();
    const [member] = await membersOf(me, workspaceId);
    expect(member?.profile.status).toBeNull();
    expect(member?.profile.outOfOffice).toBeNull();
  });

  it("refuses an unknown time zone and a range that ends before it starts", async () => {
    const me = await person("me@example.test", "Me");

    const zone = await me.as("/user/profile", {
      method: "PATCH",
      body: { timeZone: "Mars/Olympus" },
    });
    const range = await me.as("/user/profile", {
      method: "PATCH",
      body: { outOfOffice: { from: inDays(5), until: inDays(2) } },
    });

    expect(zone.status).toBe(400);
    expect(range.status).toBe(400);
  });

  it("changes only the caller's own profile", async () => {
    const me = await person("me@example.test", "Me");
    const other = await person("other@example.test", "Other");
    await other.as("/user/profile", {
      method: "PATCH",
      body: { jobTitle: "Designer" },
    });

    const response = await me.as("/user/profile", {
      method: "PATCH",
      body: { userId: other.userId, jobTitle: "Hijacked" },
    });

    const theirs = (await (await other.as("/user/profile")).json()) as Profile;
    expect(theirs.jobTitle).toBe("Designer");
    if (response.status === 200) {
      const mine = (await (await me.as("/user/profile")).json()) as Profile;
      expect(mine.jobTitle).toBe("Hijacked");
    } else {
      expect(response.status).toBe(400);
    }
  });

  it("needs a signed-in user session to change a profile", async () => {
    const me = await person("me@example.test", "Me");
    const { key } = await auth.api.createApiKey({
      body: { userId: me.userId, name: "Profile test" },
    });

    const viaKey = await call({ "x-api-key": key }, "/user/profile", {
      method: "PATCH",
      body: { jobTitle: "Via key" },
    });
    const anonymous = await call({}, "/user/profile", {
      method: "PATCH",
      body: { jobTitle: "Anonymous" },
    });
    const anonymousRead = await call({}, "/user/profile");
    // Reading your own profile is fine with a key: it changes nothing.
    const readViaKey = await call({ "x-api-key": key }, "/user/profile");

    expect(viaKey.status).toBe(403);
    expect(anonymous.status).toBe(401);
    expect(anonymousRead.status).toBe(401);
    expect(readViaKey.status).toBe(200);
    const mine = (await (await me.as("/user/profile")).json()) as Profile;
    expect(mine.jobTitle).toBeNull();
  });

  it("shows profiles only to members of the workspace, and to a guest only the people they work with", async () => {
    const owner = await person("owner@example.test", "Owner");
    const teammate = await person("teammate@example.test", "Teammate");
    const guest = await person("guest@example.test", "Guest");
    const outsider = await person("outsider@example.test", "Outsider");
    const workspaceId = await workspaceOf(owner, "acme");
    const otherWorkspaceId = await workspaceOf(outsider, "elsewhere");
    await join(workspaceId, teammate.userId);
    await join(workspaceId, guest.userId);

    const shared = await createProjectFixture({ workspaceId, name: "Shared" });
    const internal = await createProjectFixture({ workspaceId, name: "Inner" });
    await restrictToProjects(workspaceId, teammate.userId, [
      internal.project.id,
    ]);
    await restrictToProjects(workspaceId, guest.userId, [shared.project.id]);
    await db
      .update(schema.workspaceMemberAccessTable)
      .set({ guest: true })
      .where(eq(schema.workspaceMemberAccessTable.userId, guest.userId));

    await teammate.as("/user/profile", {
      method: "PATCH",
      body: { jobTitle: "Secret title", status: { text: "Secret status" } },
    });
    await outsider.as("/user/profile", {
      method: "PATCH",
      body: { jobTitle: "Elsewhere title" },
    });

    const forOwner = await (
      await owner.as(`/workspace/${workspaceId}/members`)
    ).text();
    expect(forOwner).toContain("Secret title");
    expect(forOwner).not.toContain("Elsewhere title");

    const forGuest = await (
      await guest.as(`/workspace/${workspaceId}/members`)
    ).text();
    expect(forGuest).toContain('"Owner"');
    expect(forGuest).not.toContain("Secret title");
    expect(forGuest).not.toContain("Secret status");

    const forOutsider = await outsider.as(`/workspace/${workspaceId}/members`);
    expect([403, 404]).toContain(forOutsider.status);
    expect(await forOutsider.text()).not.toContain("Secret title");
    // The outsider's own workspace does not list the other workspace's people.
    expect(
      await (
        await outsider.as(`/workspace/${otherWorkspaceId}/members`)
      ).text(),
    ).not.toContain("Secret title");
  });
});
