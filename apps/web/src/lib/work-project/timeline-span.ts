type Dated = { startDate: string | null; targetDate: string | null };

const DAY = 24 * 60 * 60 * 1000;

/** A project's dates as a bar, in percent of the span every bar shares. */
export function timelineSpan(projects: Dated[]) {
  const times = projects.flatMap((p) =>
    [p.startDate, p.targetDate]
      .filter((d): d is string => d != null)
      .map((d) => new Date(d).getTime()),
  );
  if (times.length === 0) return null;
  const min = Math.min(...times);
  // A one-day floor keeps a single date from dividing by zero.
  const length = Math.max(Math.max(...times) - min, DAY);
  return (project: Dated) => {
    const start = project.startDate ?? project.targetDate;
    const end = project.targetDate ?? project.startDate;
    if (!start || !end) return null;
    const left = ((new Date(start).getTime() - min) / length) * 100;
    const right = ((new Date(end).getTime() - min) / length) * 100;
    return { left, width: Math.max(right - left, 1) };
  };
}
