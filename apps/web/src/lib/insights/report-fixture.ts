import type { ProjectWithTasks } from "@/types/project";
import type Task from "@/types/task";

export const NOW = Date.parse("2027-03-17T12:00:00Z"); // a Wednesday
export const daysAgo = (days: number) =>
  new Date(NOW - days * 86_400_000).toISOString();

export const reportTask = (id: string, fields: Partial<Task>): Task =>
  ({
    id,
    title: id,
    number: 1,
    projectId: "alpha",
    status: "in-progress",
    createdAt: daysAgo(60),
    ...fields,
  }) as Task;

export const reportProject = (
  columns: Record<string, Task[]>,
): ProjectWithTasks =>
  ({
    id: "alpha",
    slug: "ENG",
    columns: Object.entries(columns).map(([slug, tasks]) => ({
      id: slug,
      slug,
      name: slug,
      isFinal: slug === "done",
      tasks,
    })),
  }) as unknown as ProjectWithTasks;
