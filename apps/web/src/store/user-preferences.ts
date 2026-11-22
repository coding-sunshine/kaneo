import { create } from "zustand";
import type { GroupBy } from "@/lib/group-project";
import type { CompletedIssues } from "@/lib/status-category";
import { createJSONStorage, persist } from "zustand/middleware";

export const WEEK_START_DAYS = [0, 1, 6] as const;
export type WeekStartDay = (typeof WEEK_START_DAYS)[number];

export function isWeekStartDay(value: number): value is WeekStartDay {
  return WEEK_START_DAYS.some((day) => day === value);
}

// Column ids are slugs shared across projects, so hidden state is keyed per project.
export const columnKey = (projectId: string | undefined, columnId: string) =>
  `${projectId}:${columnId}`;

export type TaskLayout = "board" | "list" | "calendar" | "gantt";

export type PriorityIconStyle = "marks" | "classic";

type UserPreferencesStore = {
  theme: "light" | "dark" | "system";
  setTheme: (
    theme: "light" | "dark" | "system",
    coordinates?: { x: number; y: number },
  ) => void;

  viewMode: "board" | "list";
  setViewMode: (mode: "board" | "list") => void;

  taskLayout: TaskLayout;
  setTaskLayout: (layout: TaskLayout) => void;

  compactMode: boolean;
  setCompactMode: (compact: boolean) => void;

  advancedSettings: boolean;
  setAdvancedSettings: (enabled: boolean) => void;

  showTaskNumbers: boolean;
  setShowTaskNumbers: (show: boolean) => void;
  toggleTaskNumbers: () => void;
  showAssignees: boolean;
  setShowAssignees: (show: boolean) => void;
  toggleAssignees: () => void;
  showDueDates: boolean;
  showEmptyColumns: boolean;
  showSubIssues: boolean;
  setShowSubIssues: (show: boolean) => void;
  showTriageIssues: boolean;
  orderCompletedByRecency: boolean;
  setOrderCompletedByRecency: (on: boolean) => void;
  setShowTriageIssues: (show: boolean) => void;
  setShowEmptyColumns: (show: boolean) => void;
  listGroupBy: GroupBy;
  setListGroupBy: (groupBy: GroupBy) => void;
  listSubGroupBy: GroupBy;
  setListSubGroupBy: (groupBy: GroupBy) => void;
  completedIssues: CompletedIssues;
  setCompletedIssues: (value: CompletedIssues) => void;
  showStatus: boolean;
  setShowStatus: (show: boolean) => void;
  showCreatedDates: boolean;
  setShowCreatedDates: (show: boolean) => void;
  setShowDueDates: (show: boolean) => void;
  toggleDueDates: () => void;
  showLabels: boolean;
  setShowLabels: (show: boolean) => void;
  toggleLabels: () => void;
  showPriority: boolean;
  setShowPriority: (show: boolean) => void;
  togglePriority: () => void;
  showEstimate: boolean;
  setShowEstimate: (show: boolean) => void;
  showProjectBackgrounds: boolean;
  setShowProjectBackgrounds: (show: boolean) => void;
  showTaskItemCounts: boolean;
  setShowTaskItemCounts: (show: boolean) => void;
  toggleTaskItemCounts: () => void;
  hiddenCardFieldIds: string[];
  hiddenColumnIds: string[];
  collapsedNavIds: string[];
  setNavOpen: (navId: string, open: boolean) => void;
  toggleColumnHidden: (columnId: string) => void;
  toggleCardFieldHidden: (fieldId: string) => void;
  resetDisplayPreferences: () => void;

  sidebarDefaultOpen: boolean;
  setSidebarDefaultOpen: (open: boolean) => void;

  insightsOpen: boolean;
  setInsightsOpen: (open: boolean) => void;

  weekStartsOn: WeekStartDay;
  setWeekStartsOn: (weekStartsOn: WeekStartDay) => void;

  priorityIconStyle: PriorityIconStyle;
  setPriorityIconStyle: (style: PriorityIconStyle) => void;
};

export const useUserPreferencesStore = create<UserPreferencesStore>()(
  persist(
    (set) => ({
      theme: "system",
      setTheme: (
        theme: "light" | "dark" | "system",
        coordinates?: { x: number; y: number },
      ) => {
        if (coordinates) {
          document.documentElement.style.setProperty(
            "--x",
            `${coordinates.x}%`,
          );
          document.documentElement.style.setProperty(
            "--y",
            `${coordinates.y}%`,
          );
        } else {
          document.documentElement.style.removeProperty("--x");
          document.documentElement.style.removeProperty("--y");
        }

        if ("startViewTransition" in document) {
          document.startViewTransition(() => {
            set({ theme });
          });
        } else {
          set({ theme });
        }
      },

      viewMode: "board",
      setViewMode: (mode) => set({ viewMode: mode }),

      taskLayout: "board",
      setTaskLayout: (layout) => set({ taskLayout: layout }),

      compactMode: false,
      setCompactMode: (compact) => set({ compactMode: compact }),

      advancedSettings: false,
      setAdvancedSettings: (enabled) => set({ advancedSettings: enabled }),

      showTaskNumbers: true,
      setShowTaskNumbers: (show) => set({ showTaskNumbers: show }),
      toggleTaskNumbers: () =>
        set((state) => ({ showTaskNumbers: !state.showTaskNumbers })),
      showAssignees: true,
      setShowAssignees: (show) => set({ showAssignees: show }),
      toggleAssignees: () =>
        set((state) => ({ showAssignees: !state.showAssignees })),
      showDueDates: true,
      setShowDueDates: (show) => set({ showDueDates: show }),
      toggleDueDates: () =>
        set((state) => ({ showDueDates: !state.showDueDates })),
      collapsedNavIds: [],
      setNavOpen: (navId, open) =>
        set((state) => ({
          collapsedNavIds: open
            ? state.collapsedNavIds.filter((id) => id !== navId)
            : [...new Set([...state.collapsedNavIds, navId])],
        })),
      hiddenColumnIds: [],
      toggleColumnHidden: (columnId) =>
        set((state) => ({
          hiddenColumnIds: state.hiddenColumnIds.includes(columnId)
            ? state.hiddenColumnIds.filter((id) => id !== columnId)
            : [...state.hiddenColumnIds, columnId],
        })),
      showEmptyColumns: false,
      setShowEmptyColumns: (show) => set({ showEmptyColumns: show }),
      showSubIssues: false,
      setShowSubIssues: (show) => set({ showSubIssues: show }),
      showTriageIssues: false,
      setShowTriageIssues: (show) => set({ showTriageIssues: show }),
      orderCompletedByRecency: false,
      setOrderCompletedByRecency: (on) => set({ orderCompletedByRecency: on }),
      listGroupBy: "status",
      setListGroupBy: (listGroupBy) => set({ listGroupBy }),
      listSubGroupBy: "none",
      setListSubGroupBy: (listSubGroupBy) => set({ listSubGroupBy }),
      completedIssues: "all",
      setCompletedIssues: (completedIssues) => set({ completedIssues }),
      showStatus: true,
      setShowStatus: (show) => set({ showStatus: show }),
      showCreatedDates: true,
      setShowCreatedDates: (show) => set({ showCreatedDates: show }),
      showLabels: true,
      setShowLabels: (show) => set({ showLabels: show }),
      toggleLabels: () => set((state) => ({ showLabels: !state.showLabels })),
      showPriority: true,
      setShowPriority: (show) => set({ showPriority: show }),
      togglePriority: () =>
        set((state) => ({ showPriority: !state.showPriority })),
      showEstimate: true,
      setShowEstimate: (show) => set({ showEstimate: show }),
      showProjectBackgrounds: true,
      setShowProjectBackgrounds: (show) =>
        set({ showProjectBackgrounds: show }),
      showTaskItemCounts: true,
      setShowTaskItemCounts: (show) => set({ showTaskItemCounts: show }),
      toggleTaskItemCounts: () =>
        set((state) => ({ showTaskItemCounts: !state.showTaskItemCounts })),
      hiddenCardFieldIds: [],
      toggleCardFieldHidden: (fieldId) =>
        set((state) => ({
          hiddenCardFieldIds: state.hiddenCardFieldIds.includes(fieldId)
            ? state.hiddenCardFieldIds.filter((id) => id !== fieldId)
            : [...state.hiddenCardFieldIds, fieldId],
        })),
      resetDisplayPreferences: () =>
        set({
          hiddenCardFieldIds: [],
          hiddenColumnIds: [],
          showAssignees: true,
          showDueDates: true,
          showStatus: true,
          listGroupBy: "status",
          listSubGroupBy: "none",
          completedIssues: "all",
          showEmptyColumns: false,
          showSubIssues: false,
          showTriageIssues: false,
          orderCompletedByRecency: false,
          showCreatedDates: true,
          showLabels: true,
          showTaskNumbers: true,
          showPriority: true,
          showEstimate: true,
          showTaskItemCounts: true,
        }),

      sidebarDefaultOpen: true,
      setSidebarDefaultOpen: (open) => set({ sidebarDefaultOpen: open }),

      insightsOpen: false,
      setInsightsOpen: (open) => set({ insightsOpen: open }),

      weekStartsOn: 0,
      setWeekStartsOn: (weekStartsOn) => set({ weekStartsOn }),

      priorityIconStyle: "marks",
      setPriorityIconStyle: (priorityIconStyle) => set({ priorityIconStyle }),
    }),
    {
      name: "user-preferences",
      storage: createJSONStorage(() => localStorage),
      onRehydrateStorage: () => (state) => {
        if (state && !isWeekStartDay(state.weekStartsOn)) {
          state.setWeekStartsOn(0);
        }
      },
    },
  ),
);
