// Linear's "Customize sidebar": every top-level row has a visibility, rows
// can be reordered inside their section, and counts render as a number, a
// dot or nothing.

import {
  REVIEWS_COUNT_OPTIONS,
  type ReviewsCountOption,
} from "@/lib/reviews-count";

export type SidebarItemId =
  | "inbox"
  | "myTasks"
  | "reviews"
  | "pulse"
  | "documents"
  | "agent"
  | "drafts"
  | "projects"
  | "views"
  | "chat"
  | "members"
  | "loops"
  | "teams";
export type SidebarSection = "personal" | "workspace";
export type SidebarVisibility = "always" | "badged" | "never";
export type BadgeStyle = "count" | "dot";
export type ItemBadge = BadgeStyle | "none";
/** Which inbox notifications feed the Inbox badge. */
export type InboxCountMode = "all" | "priority" | "none";

export type SidebarPrefs = {
  visibility: Partial<Record<SidebarItemId, SidebarVisibility>>;
  order: Partial<Record<SidebarSection, SidebarItemId[]>>;
  badgeStyle: BadgeStyle;
  itemBadges: Partial<Record<SidebarItemId, ItemBadge>>;
  inboxCount: InboxCountMode;
  reviewsCount: ReviewsCountOption[];
};

export const DEFAULT_SIDEBAR_PREFS: SidebarPrefs = {
  visibility: {},
  order: {},
  badgeStyle: "count",
  itemBadges: {},
  inboxCount: "all",
  reviewsCount: REVIEWS_COUNT_OPTIONS,
};

export const SIDEBAR_SECTIONS: Record<SidebarSection, SidebarItemId[]> = {
  personal: [
    "inbox",
    "myTasks",
    "reviews",
    "pulse",
    "documents",
    "agent",
    "drafts",
  ],
  workspace: ["projects", "views", "chat", "members", "loops", "teams"],
};

// Linear keeps these two behind the workspace "More" menu until asked.
const HIDDEN_BY_DEFAULT = new Set<SidebarItemId>(["members", "teams"]);

// Linear shows Drafts only once something is waiting in it.
const BADGED_BY_DEFAULT = new Set<SidebarItemId>(["drafts"]);

// "Show when badged" and the Badge submenu only make sense for a row that
// has a count to show.
export const BADGEABLE = new Set<SidebarItemId>(["inbox", "reviews", "drafts"]);

// Literal keys so the i18n tooling can see every label in use.
export const VISIBILITY_LABELS = {
  always: "navigation:customizeSidebar.always",
  badged: "navigation:customizeSidebar.badged",
  never: "navigation:customizeSidebar.never",
} as const satisfies Record<SidebarVisibility, string>;

export const BADGE_LABELS = {
  count: "navigation:customizeSidebar.count",
  dot: "navigation:customizeSidebar.dot",
  none: "navigation:customizeSidebar.none",
} as const satisfies Record<ItemBadge, string>;

export function visibilityOptions(id: SidebarItemId): SidebarVisibility[] {
  if (id === "inbox") return ["always", "badged"];
  return BADGEABLE.has(id)
    ? ["always", "badged", "never"]
    : ["always", "never"];
}

export function visibilityOf(
  id: SidebarItemId,
  visibility: SidebarPrefs["visibility"],
): SidebarVisibility {
  const value =
    visibility[id] ??
    (HIDDEN_BY_DEFAULT.has(id)
      ? "never"
      : BADGED_BY_DEFAULT.has(id)
        ? "badged"
        : "always");
  return visibilityOptions(id).includes(value) ? value : "always";
}

/** Saved order first; rows added since the order was saved keep their default spot at the end. */
export function orderSection(
  section: SidebarSection,
  saved: SidebarItemId[] = [],
): SidebarItemId[] {
  const ids = SIDEBAR_SECTIONS[section];
  const kept = saved.filter((id) => ids.includes(id));
  return [...kept, ...ids.filter((id) => !kept.includes(id))];
}

/** The rows a person can see, in their saved order. */
export function orderItems<T extends { id: SidebarItemId }>(
  section: SidebarSection,
  available: T[],
  saved?: SidebarItemId[],
): T[] {
  const byId = new Map(available.map((item) => [item.id, item]));
  return orderSection(section, saved).flatMap((id) => byId.get(id) ?? []);
}

export function badgeOf(id: SidebarItemId, prefs: SidebarPrefs): ItemBadge {
  return prefs.itemBadges[id] ?? prefs.badgeStyle;
}

/**
 * Splits the rows a section can show into what the sidebar lists and what
 * the "More" menu keeps. Rows set to show when badged stay out of both
 * until they have a count.
 */
export function arrangeSection<T extends { id: SidebarItemId; count?: number }>(
  section: SidebarSection,
  available: T[],
  prefs: SidebarPrefs,
): { shown: T[]; hidden: T[] } {
  const ordered = orderItems(section, available, prefs.order[section]);
  return {
    shown: ordered.filter((item) => {
      const visibility = visibilityOf(item.id, prefs.visibility);
      return (
        visibility === "always" || (visibility === "badged" && !!item.count)
      );
    }),
    hidden: ordered.filter(
      (item) => visibilityOf(item.id, prefs.visibility) === "never",
    ),
  };
}
