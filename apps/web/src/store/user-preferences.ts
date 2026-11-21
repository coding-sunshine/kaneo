import { create } from "zustand";
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
  setShowEmptyColumns: (show: boolean) => void;
  listGroupBy: "status" | "priority" | "assignee";
  setListGroupBy: (groupBy: "status" | "priority" | "assignee") => void;
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
  showProjectBackgrounds: boolean;
  setShowProjectBackgrounds: (show: boolean) => void;
  showTaskItemCounts: boolean;
  setShowTaskItemCounts: (show: boolean) => void;
  toggleTaskItemCounts: () => void;
  hiddenCardFieldIds: string[];
  hiddenColumnIds: string[];
  toggleColumnHidden: (columnId: string) => void;
  toggleCardFieldHidden: (fieldId: string) => void;
  resetDisplayPreferences: () => void;

  sidebarDefaultOpen: boolean;
  setSidebarDefaultOpen: (open: boolean) => void;

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
      hiddenColumnIds: [],
      toggleColumnHidden: (columnId) =>
        set((state) => ({
          hiddenColumnIds: state.hiddenColumnIds.includes(columnId)
            ? state.hiddenColumnIds.filter((id) => id !== columnId)
            : [...state.hiddenColumnIds, columnId],
        })),
      showEmptyColumns: false,
      setShowEmptyColumns: (show) => set({ showEmptyColumns: show }),
      listGroupBy: "status",
      setListGroupBy: (listGroupBy) => set({ listGroupBy }),
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
          showEmptyColumns: false,
          showCreatedDates: true,
          showLabels: true,
          showTaskNumbers: true,
          showPriority: true,
          showTaskItemCounts: true,
        }),

      sidebarDefaultOpen: true,
      setSidebarDefaultOpen: (open) => set({ sidebarDefaultOpen: open }),

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
