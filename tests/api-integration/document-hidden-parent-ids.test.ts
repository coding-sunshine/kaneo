import { beforeEach, describe, expect, it } from "vite-plus/test";
import { resetTestDatabase } from "./helpers/database";
import {
  buildDocumentWorld,
  type DocumentWorld,
  json,
  SEARCH_WORD,
} from "./helpers/document-access/build-document-world";

type Ids = { id: string; projectId?: string | null; taskId?: string | null };

let world: DocumentWorld;

beforeEach(async () => {
  await resetTestDatabase();
  world = await buildDocumentWorld();
  // `limited` cannot open team Beta; both documents are shared by name.
  const shared = await world.as(world.owner)(
    `/document/workspace/${world.ws}/${world.docs.issueBeta}/share/${world.limited.id}`,
    json("PUT", { access: "view" }),
  );
  expect(shared.status).toBe(200);
});

const parentIds = (row: Ids | undefined) => ({
  projectId: row?.projectId ?? null,
  taskId: row?.taskId ?? null,
});

async function answers(user: DocumentWorld["owner"], documentId: string) {
  const ask = world.as(user);
  const list = (await (
    await ask(`/document/workspace/${world.ws}`)
  ).json()) as Ids[];
  const get = (await (
    await ask(`/document/workspace/${world.ws}/${documentId}`)
  ).json()) as Ids;
  const search = (await (
    await ask(
      `/search?workspaceId=${world.ws}&q=${SEARCH_WORD}&type=documents&limit=50`,
    )
  ).json()) as { results: Ids[] };
  return {
    list: parentIds(list.find((row) => row.id === documentId)),
    get: parentIds(get),
    search: parentIds(search.results.find((row) => row.id === documentId)),
  };
}

const NONE = { projectId: null, taskId: null };

describe("a shared document in a place the reader cannot open", () => {
  it("leaves out the team id", async () => {
    expect(await answers(world.limited, world.docs.sharedInBeta)).toEqual({
      list: NONE,
      get: NONE,
      search: NONE,
    });
  });

  it("leaves out the issue id", async () => {
    expect(await answers(world.limited, world.docs.issueBeta)).toEqual({
      list: NONE,
      get: NONE,
      search: NONE,
    });
  });

  it("still names both to a member who can open them", async () => {
    const team = { projectId: world.beta.id, taskId: null };
    expect(await answers(world.open, world.docs.sharedInBeta)).toEqual({
      list: team,
      get: team,
      search: team,
    });
    const issue = { projectId: null, taskId: world.betaTask.id };
    const seen = await answers(world.open, world.docs.issueBeta);
    expect(seen.list).toEqual(issue);
    expect(seen.get).toEqual(issue);
  });
});
