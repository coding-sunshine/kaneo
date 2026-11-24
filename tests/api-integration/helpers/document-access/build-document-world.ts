import db, { schema } from "../../../../apps/api/src/database";
import { createApp } from "../../../../apps/api/src/index";
import { mockAuthenticatedSession } from "../auth";
import {
  createProjectFixture,
  createWorkspaceMember,
  type SeededMemberContext,
} from "../fixtures";
import { addWorkspaceMember } from "../project-access/add-workspace-member";
import { createTaskFixture } from "../project-access/create-task-fixture";
import { restrictToProjects } from "../project-access/restrict-to-projects";

type User = SeededMemberContext["user"];

export const json = (method: string, body?: unknown) => ({
  method,
  headers: { "content-type": "application/json" },
  body: body === undefined ? undefined : JSON.stringify(body),
});

// Every document title carries this word, so one search finds them all.
export const SEARCH_WORD = "leakdoc";

// One workspace, two teams, and one document in every place a document can
// live. `limited` may only enter team Alpha; `open` may enter every team.
// The owner writes every document, so nobody else gets in as the author.
export async function buildDocumentWorld() {
  const { user: owner, workspace } = await createWorkspaceMember({
    role: "owner",
  });
  const ws = workspace.id;
  const alpha = await createProjectFixture({
    workspaceId: ws,
    name: "Alpha",
    slug: "alpha",
  });
  const beta = await createProjectFixture({
    workspaceId: ws,
    name: "Beta",
    slug: "beta",
  });
  const limited = await addWorkspaceMember(ws);
  await restrictToProjects(ws, limited.id, [alpha.project.id]);
  const open = await addWorkspaceMember(ws);
  const alphaTask = await createTaskFixture(alpha, "Alpha issue", owner.id);
  const betaTask = await createTaskFixture(beta, "Beta issue", owner.id);
  const [workProject] = await db
    .insert(schema.workProjectTable)
    .values({ workspaceId: ws, name: "Launch" })
    .returning();

  const { app } = createApp();
  const as = (user: User) => {
    mockAuthenticatedSession(user);
    return (path: string, init?: ReturnType<typeof json>) =>
      app.request(`/api${path}`, init);
  };

  const create = async (place: string, parent: Record<string, string> = {}) => {
    const response = await as(owner)(
      "/document",
      json("POST", {
        workspaceId: ws,
        title: `${SEARCH_WORD} ${place}`,
        content: `<p>${place}</p>`,
        ...parent,
      }),
    );
    if (response.status !== 200) {
      throw new Error(`Could not create the ${place} document`);
    }
    return ((await response.json()) as { id: string }).id;
  };
  const share = (id: string, user: User) =>
    as(owner)(
      `/document/workspace/${ws}/${id}/share/${user.id}`,
      json("PUT", { access: "view" }),
    );

  const docs = {
    private: await create("private"),
    sharedByName: await create("sharedByName"),
    teamAlpha: await create("teamAlpha", { projectId: alpha.project.id }),
    teamBeta: await create("teamBeta", { projectId: beta.project.id }),
    issueAlpha: await create("issueAlpha", { taskId: alphaTask.id }),
    issueBeta: await create("issueBeta", { taskId: betaTask.id }),
    project: await create("project", { workProjectId: workProject.id }),
    workspace: await create("workspace"),
    // Lives in a team `limited` cannot enter, and is shared with them by name.
    sharedInBeta: await create("sharedInBeta", { projectId: beta.project.id }),
  };
  await as(owner)(
    `/document/workspace/${ws}/${docs.workspace}/location`,
    json("PUT", { scope: "workspace" }),
  );
  await share(docs.sharedByName, limited);
  await share(docs.sharedInBeta, limited);

  return {
    ws,
    owner,
    limited,
    open,
    alpha: alpha.project,
    beta: beta.project,
    alphaTask,
    betaTask,
    workProject,
    docs,
    as,
  };
}

export type DocumentWorld = Awaited<ReturnType<typeof buildDocumentWorld>>;
export type DocumentPlace = keyof DocumentWorld["docs"];
