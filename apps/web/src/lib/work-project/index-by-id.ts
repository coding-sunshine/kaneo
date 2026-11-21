export function indexById<T extends { id: string }>(items: T[] | undefined) {
  return new Map((items ?? []).map((item) => [item.id, item]));
}
