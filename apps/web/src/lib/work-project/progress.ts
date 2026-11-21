export function progressPercent(progress: { total: number; done: number }) {
  return progress.total > 0
    ? Math.round((progress.done / progress.total) * 100)
    : 0;
}
