import { describe, expect, it } from "vite-plus/test";
import {
  arrangeSection,
  DEFAULT_SIDEBAR_PREFS,
  orderSection,
  type SidebarItemId,
  type SidebarPrefs,
  visibilityOf,
  visibilityOptions,
} from "./sidebar-items";

const prefs = (patch: Partial<SidebarPrefs> = {}): SidebarPrefs => ({
  ...DEFAULT_SIDEBAR_PREFS,
  ...patch,
});
const rows = (...ids: SidebarItemId[]) => ids.map((id) => ({ id }));
const ids = (items: { id: SidebarItemId }[]) => items.map((item) => item.id);

describe("sidebar items", () => {
  it("starts like Linear: Members and Teams wait in More", () => {
    const { shown, hidden } = arrangeSection(
      "workspace",
      rows("projects", "views", "members", "loops", "teams"),
      prefs(),
    );
    expect(ids(shown)).toEqual(["projects", "views", "loops"]);
    expect(ids(hidden)).toEqual(["members", "teams"]);
  });

  it("moves a row between the sidebar and More when its visibility changes", () => {
    const { shown, hidden } = arrangeSection(
      "workspace",
      rows("projects", "views", "members", "loops", "teams"),
      prefs({ visibility: { members: "always", views: "never" } }),
    );
    expect(ids(shown)).toEqual(["projects", "members", "loops"]);
    expect(ids(hidden)).toEqual(["views", "teams"]);
  });

  it("shows a badged-only row just while it has a count", () => {
    const visibility = { inbox: "badged" } as const;
    const quiet = arrangeSection(
      "personal",
      [{ id: "inbox" as const, count: 0 }, ...rows("myTasks")],
      prefs({ visibility }),
    );
    expect(ids(quiet.shown)).toEqual(["myTasks"]);
    expect(quiet.hidden).toEqual([]);

    const busy = arrangeSection(
      "personal",
      [{ id: "inbox" as const, count: 3 }, ...rows("myTasks")],
      prefs({ visibility }),
    );
    expect(ids(busy.shown)).toEqual(["inbox", "myTasks"]);
  });

  it("treats show-when-badged as always on a row with no count", () => {
    expect(visibilityOf("projects", { projects: "badged" })).toBe("always");
  });

  it("keeps the saved order and appends rows added later", () => {
    expect(
      orderSection("workspace", ["teams", "projects", "gone" as never]),
    ).toEqual(["teams", "projects", "views", "chat", "members", "loops"]);
  });

  it("skips rows the person cannot see, such as Agent without an agent", () => {
    const { shown } = arrangeSection(
      "personal",
      rows("inbox", "documents"),
      prefs({ order: { personal: ["agent", "documents", "inbox"] } }),
    );
    expect(ids(shown)).toEqual(["documents", "inbox"]);
  });

  it("offers Inbox only Always and Show when badged; Reviews all three", () => {
    expect(visibilityOptions("inbox")).toEqual(["always", "badged"]);
    expect(visibilityOptions("reviews")).toEqual(["always", "badged", "never"]);
    expect(visibilityOptions("pulse")).toEqual(["always", "never"]);
  });

  it("shows Drafts only when badged, and never files it under More", () => {
    expect(visibilityOf("drafts", {})).toBe("badged");
    const empty = arrangeSection(
      "personal",
      [{ id: "drafts" as const }],
      prefs(),
    );
    expect(empty).toEqual({ shown: [], hidden: [] });
    const full = arrangeSection(
      "personal",
      [{ id: "drafts" as const, count: 2 }],
      prefs(),
    );
    expect(ids(full.shown)).toEqual(["drafts"]);
  });
});
