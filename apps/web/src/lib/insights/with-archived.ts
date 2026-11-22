import type { ProjectWithTasks } from "@/types/project";

/** Linear's "Show archived issues": the archived issues become one more status slice. */
export function withArchived(project: ProjectWithTasks): ProjectWithTasks {
  const tasks = project.archivedTasks ?? [];
  if (tasks.length === 0) return project;
  return {
    ...project,
    columns: [
      ...project.columns,
      {
        id: "archived",
        slug: "archived",
        name: "Archived",
        icon: "Archive",
        isFinal: true,
        tasks,
      },
    ],
  };
}
