import type { CreateIssueDraft } from "@/store/create-issue";
import type Task from "@/types/task";

export function quoteMarkdown(markdown: string) {
  return markdown
    .trim()
    .split("\n")
    .map((line) => (line ? `> ${line}` : ">"))
    .join("\n");
}

// "New issue" relates the new issue to the current one; "New sub-issue" makes
// the current issue its parent. Both stay in the current issue's project.
export function buildIssueDraft(
  variant: "related" | "parent",
  task: Pick<
    Task,
    "id" | "projectId" | "workProjectId" | "workProjectMilestoneId"
  >,
  commentMarkdown: string,
): CreateIssueDraft {
  return {
    projectId: task.projectId,
    description: quoteMarkdown(commentMarkdown),
    workProjectId: task.workProjectId,
    workProjectMilestoneId: task.workProjectMilestoneId,
    link: { taskId: task.id, type: variant },
  };
}
