import { beforeEach, describe, expect, it } from "vite-plus/test";
import { createApp } from "../../apps/api/src/index";
import { mockAuthenticatedSession } from "./helpers/auth";
import { resetTestDatabase } from "./helpers/database";
import {
  createProjectFixture,
  createWorkspaceMember,
} from "./helpers/fixtures";

type Activity = {
  id: string;
  createdIssues: Array<{
    id: string;
    projectSlug: string;
    number: number | null;
    title: string;
    isSubIssue: boolean;
    creatorId: string | null;
    creatorName: string | null;
  }>;
};

describe("API integration: issues created from a comment", () => {
  beforeEach(async () => {
    await resetTestDatabase();
  });

  it("lists issues made from a comment under it and rejects foreign comments", async () => {
    const member = await createWorkspaceMember();
    const { project } = await createProjectFixture({
      workspaceId: member.workspace.id,
    });
    mockAuthenticatedSession(member.user);
    const { app } = createApp();
    const post = (path: string, body: unknown) =>
      app.request(path, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(body),
      });
    const newTask = { description: "", priority: "low", status: "to-do" };
    const parentResponse = await post(`/api/task/${project.id}`, {
      ...newTask,
      title: "Parent",
    });
    expect(parentResponse.status).toBe(200);
    const parent = (await parentResponse.json()) as { id: string };
    const feed = async () => {
      const response = await app.request(`/api/activity/${parent.id}`);
      expect(response.status).toBe(200);
      return (await response.json()) as Activity[];
    };

    const commentResponse = await post("/api/activity/comment", {
      taskId: parent.id,
      comment: "Split this out",
    });
    expect(commentResponse.status).toBe(200);
    const comment = (await commentResponse.json()) as Activity;
    expect(
      (await feed()).find((row) => row.id === comment.id)?.createdIssues,
    ).toEqual([]);

    const created = await post(`/api/task/${project.id}`, {
      ...newTask,
      title: "Follow-up",
      sourceCommentId: comment.id,
    });
    expect(created.status, await created.clone().text()).toBe(200);
    const task = (await created.json()) as { id: string };

    const [issue] =
      (await feed()).find((row) => row.id === comment.id)?.createdIssues ?? [];
    expect(issue).toMatchObject({
      id: task.id,
      title: "Follow-up",
      isSubIssue: false,
      creatorId: member.user.id,
    });

    const linked = await post("/api/task-relation", {
      sourceTaskId: parent.id,
      targetTaskId: task.id,
      relationType: "subtask",
    });
    expect(linked.status, await linked.clone().text()).toBe(200);
    expect(
      (await feed()).find((row) => row.id === comment.id)?.createdIssues[0]
        ?.isSubIssue,
    ).toBe(true);

    // Someone in another workspace cannot hang their task off this comment.
    const outsider = await createWorkspaceMember();
    const other = await createProjectFixture({
      workspaceId: outsider.workspace.id,
    });
    mockAuthenticatedSession(outsider.user);
    const rejected = await post(`/api/task/${other.project.id}`, {
      ...newTask,
      title: "Elsewhere",
      sourceCommentId: comment.id,
    });
    expect(rejected.status).toBe(400);
  });
});
