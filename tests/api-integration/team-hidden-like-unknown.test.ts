import { beforeEach, describe, expect, it } from "vite-plus/test";
import { resetTestDatabase } from "./helpers/database";
import {
  buildDocumentWorld,
  type DocumentWorld,
  json,
} from "./helpers/document-access/build-document-world";

let world: DocumentWorld;

beforeEach(async () => {
  await resetTestDatabase();
  world = await buildDocumentWorld();
});

// `limited` may enter team Alpha only. Every answer about team Beta must be
// the answer for a team id that does not exist.
const UNKNOWN = "no-such-team";

async function same(
  ask: (teamId: string) => Promise<Response>,
  open: string = world.alpha.id,
) {
  const unknown = await ask(UNKNOWN);
  const hidden = await ask(world.beta.id);
  expect(unknown.status).toBeGreaterThanOrEqual(400);
  expect(hidden.status).toBe(unknown.status);
  expect(await hidden.json()).toEqual(await unknown.json());
  return ask(open);
}

describe("a team the caller cannot open answers like an unknown team", () => {
  it("in the workspace member list", async () => {
    const ask = (teamId: string) =>
      Promise.resolve(
        world.as(world.limited)(
          `/workspace/${world.ws}/members?projectId=${teamId}`,
        ),
      );
    expect((await same(ask)).status).toBe(200);
  });

  it("as the destination of a moved issue", async () => {
    const ask = (teamId: string) =>
      Promise.resolve(
        world.as(world.limited)(
          `/task/move/${world.alphaTask.id}`,
          json("PUT", { destinationProjectId: teamId }),
        ),
      );
    await same(ask, world.alpha.id);
  });

  it("in a code hosting route scoped by the body", async () => {
    const ask = (teamId: string) =>
      Promise.resolve(
        world.as(world.limited)(
          "/github-integration/verify",
          json("POST", { projectId: teamId }),
        ),
      );
    await same(ask);
  });

  it("as the parent of a new document", async () => {
    const ask = (body: Record<string, string>) =>
      Promise.resolve(
        world.as(world.limited)(
          "/document",
          json("POST", {
            workspaceId: world.ws,
            title: "Plan",
            content: "<p>Plan</p>",
            ...body,
          }),
        ),
      );
    expect((await same((id) => ask({ projectId: id }))).status).toBe(200);
    const unknown = await ask({ taskId: "no-such-issue" });
    const hidden = await ask({ taskId: world.betaTask.id });
    expect(hidden.status).toBe(unknown.status);
    expect(await hidden.json()).toEqual(await unknown.json());
  });

  it("as the team a new team copies its settings from", async () => {
    const ask = (teamId: string) =>
      Promise.resolve(
        world.as(world.limited)(
          "/project",
          json("POST", {
            workspaceId: world.ws,
            name: "Copy",
            icon: "Folder",
            slug: `c${teamId.length}`,
            copySettingsFromProjectId: teamId,
          }),
        ),
      );
    await same(ask);
  });
});
