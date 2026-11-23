import { describe, expect, it } from "vite-plus/test";
import { inboxCount } from "./inbox-count";

const n = (type: string, extra: object = {}) =>
  ({ type, isRead: false, snoozedUntil: null, ...extra }) as never;
const list = [
  n("task_mention"),
  n("task_comment"),
  n("task_mention", { isRead: true }),
  n("task_overdue", { snoozedUntil: "2999-01-01T00:00:00Z" }),
];

describe("inboxCount", () => {
  it("counts unread, non-snoozed for all", () => {
    expect(inboxCount(list, "all")).toBe(2);
  });
  it("counts only priority types for priority", () => {
    expect(inboxCount(list, "priority")).toBe(1);
  });
  it("is 0 for none", () => {
    expect(inboxCount(list, "none")).toBe(0);
  });
});
