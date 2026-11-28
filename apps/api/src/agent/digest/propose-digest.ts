import db from "../../database";
import { agentProposalTable } from "../../database/schema";
import { canPostProjectUpdate } from "../proposals/can-post-project-update";
import type { ProposalTurn } from "../proposals/create-proposal";
import { workProjectName } from "../proposals/create-proposal";
import type { ProposeRequest } from "../tools";
import {
  type DigestLine,
  type DigestSections,
  digestBody,
  digestHealth,
} from "./digest-body";
import {
  DIGEST_SECTIONS,
  type DigestArgs,
  digestSchema,
  POST_DIGEST_TOOL,
} from "./digest-tool";

type Task = {
  id: string;
  title: string;
  workspaceId: string;
  projectId: string;
};

const refuse = (message: string) => JSON.stringify({ error: message });

const clientUrl = () => process.env.KANEO_CLIENT_URL || "http://localhost:5173";

/**
 * Lays the model's picks out as a digest draft for the person running it.
 * Every ticket is read as that person: one they cannot open, or one of
 * another workspace, is left out with its note, so its title never reaches
 * the draft.
 */
export async function proposeDigest(
  turn: ProposalTurn,
  request: ProposeRequest,
  toolCallId: string,
) {
  const parsed = digestSchema.safeParse(request.args);
  if (!parsed.success) return refuse("The digest is not valid");
  const args: DigestArgs = parsed.data;
  const projectName = (await canPostProjectUpdate(
    turn.workspaceId,
    turn.userId,
  ))
    ? await workProjectName(turn.workspaceId, args.workProjectId)
    : null;
  if (!projectName) return refuse("Project not found");

  const readable = new Map<string, Task | null>();
  const read = async (taskId: string) => {
    if (!readable.has(taskId)) {
      const task = await turn.client
        .json<Task>(`/api/task/${encodeURIComponent(taskId)}`)
        .catch(() => null);
      readable.set(
        taskId,
        task?.workspaceId === turn.workspaceId ? task : null,
      );
    }
    return readable.get(taskId) ?? null;
  };
  const sections = {} as DigestSections;
  for (const { key } of DIGEST_SECTIONS) {
    const lines: DigestLine[] = [];
    for (const { taskId, note } of args[key]) {
      const task = await read(taskId);
      if (!task) continue;
      lines.push({
        title: task.title,
        url: `${clientUrl()}/dashboard/workspace/${turn.workspaceId}/project/${task.projectId}/task/${task.id}`,
        note,
      });
    }
    sections[key] = lines;
  }

  const body = digestBody(sections);
  const post = {
    workProjectId: args.workProjectId,
    health: digestHealth(sections),
    body,
  };
  const included = [...readable.values()].filter(
    (task): task is Task => task !== null,
  );
  const [row] = await db
    .insert(agentProposalTable)
    .values({
      workspaceId: turn.workspaceId,
      chatId: turn.chatId,
      userId: turn.userId,
      toolCallId,
      tool: POST_DIGEST_TOOL,
      arguments: post,
      taskId: null,
      projectId: args.workProjectId,
      prompt: turn.prompt,
      // The model's own call may name tickets the reader cannot open.
      toolCalls: [],
      sources: included.map((task) => ({ kind: "task" as const, id: task.id })),
      diff: [
        { field: "project", from: null, to: projectName },
        { field: "health", from: null, to: post.health },
        { field: "update", from: null, to: body },
      ],
      reason: request.reason,
    })
    .returning({ id: agentProposalTable.id });
  return JSON.stringify({
    proposalId: row?.id,
    status: "pending",
    note: "Drafted, not posted. It is posted only when the person accepts it on Pulse.",
  });
}
