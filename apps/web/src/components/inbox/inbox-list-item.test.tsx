import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vite-plus/test";
import type { Notification } from "@/types/notification";
import { InboxListItem } from "./inbox-list-item";

vi.mock("@/hooks/mutations/notification/use-delete-notification", () => ({
  default: () => ({ mutate: vi.fn() }),
}));
vi.mock("@/hooks/mutations/notification/use-mark-notification-as-read", () => ({
  default: () => ({ mutate: vi.fn() }),
}));
vi.mock(
  "@/hooks/mutations/notification/use-mark-notification-as-unread",
  () => ({ default: () => ({ mutate: vi.fn() }) }),
);
vi.mock("./snooze-menu", () => ({
  SnoozeButton: () => null,
  SnoozeRows: () => null,
  useSnooze: () => vi.fn(),
}));
vi.mock("react-i18next", () => ({
  initReactI18next: { type: "3rdParty", init: vi.fn() },
  useTranslation: () => ({
    t: (_key: string, options?: { defaultValue?: string }) =>
      options?.defaultValue ?? _key,
  }),
}));

afterEach(cleanup);

describe("inbox list item", () => {
  it("heads a document comment with the document and a plain preview", () => {
    render(
      <InboxListItem
        notification={
          {
            id: "n1",
            userId: "u1",
            snoozedUntil: null,
            updatedAt: new Date().toISOString(),
            type: "document_comment",
            title: "Alex commented",
            content: "Brief",
            isRead: false,
            resourceId: "doc-1",
            resourceType: "document",
            eventData: {
              documentTitle: "Brief",
              commentPreview: 'See <kaneo-mention id="u2">@Sam</kaneo-mention>',
            },
            createdAt: new Date().toISOString(),
          } as Notification
        }
        isSelected={false}
        onSelect={vi.fn()}
      />,
    );
    expect(screen.getByText("Brief")).toBeTruthy();
    expect(screen.getByText("Alex commented: See @Sam")).toBeTruthy();
  });
});
