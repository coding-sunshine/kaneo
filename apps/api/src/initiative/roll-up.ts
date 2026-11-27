import { WORK_PROJECT_HEALTHS } from "../work-project/schema";

type Health = (typeof WORK_PROJECT_HEALTHS)[number];
type Progress = { total: number; done: number };

// A project that is done or dropped no longer speaks for the initiative.
const CLOSED_STATUSES = new Set(["completed", "canceled"]);

const isHealth = (value: string | null): value is Health =>
  (WORK_PROJECT_HEALTHS as readonly (string | null)[]).includes(value);

/**
 * The initiative's health is the worst of its own latest update and the
 * health of its open projects; null when none of them has said anything.
 */
export function rollUpHealth(
  own: string | null,
  projects: { health: string | null; status: string }[],
): Health | null {
  const healths = [
    own,
    ...projects
      .filter((project) => !CLOSED_STATUSES.has(project.status))
      .map((project) => project.health),
  ].filter(isHealth);
  if (healths.length === 0) return null;
  return healths.reduce((worst, health) =>
    WORK_PROJECT_HEALTHS.indexOf(health) > WORK_PROJECT_HEALTHS.indexOf(worst)
      ? health
      : worst,
  );
}

export function rollUpProgress(projects: { progress: Progress }[]): Progress {
  return projects.reduce(
    (sum, { progress }) => ({
      total: sum.total + progress.total,
      done: sum.done + progress.done,
    }),
    { total: 0, done: 0 },
  );
}
