import { useCreateIssueStore } from "@/store/create-issue";
import { ShortcutKeys } from "@/components/shortcuts/shortcut-keys";
import { useShortcutsPanelStore } from "@/components/shortcuts/shortcuts-panel-store";
import { useLocation, useNavigate } from "@tanstack/react-router";
import {
  ArrowDownIcon,
  ArrowUpIcon,
  BoxIcon,
  CornerDownLeftIcon,
  InboxIcon,
  PlusIcon,
  SettingsIcon,
  UserIcon,
  UsersIcon,
} from "lucide-react";
import type { ComponentType } from "react";
import { Fragment, useCallback, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import SearchCommandMenu from "@/components/search-command-menu";
import CreateTaskModal from "@/components/shared/modals/create-task-modal";
import CreateWorkspaceModal from "@/components/shared/modals/create-workspace-modal";
import {
  Command,
  CommandCollection,
  CommandDialog,
  CommandDialogPopup,
  CommandEmpty,
  CommandFooter,
  CommandGroup,
  CommandGroupLabel,
  CommandInput,
  CommandItem,
  CommandList,
  CommandPanel,
  CommandSeparator,
  CommandShortcut,
} from "@/components/ui/command";
import { Kbd, KbdGroup } from "@/components/ui/kbd";
import useGlobalSearch from "@/hooks/queries/search/use-global-search";
import useGetConfig from "@/hooks/queries/config/use-get-config";
import useActiveWorkspace from "@/hooks/queries/workspace/use-active-workspace";
import { useShortcut } from "@/lib/shortcuts/use-shortcut";
import type { ShortcutId } from "@/lib/shortcuts/catalog";
import { authClient } from "@/lib/auth-client";
import { hasInstanceAdminRole } from "@/lib/instance-admin";
import { useUserPreferencesStore } from "@/store/user-preferences";
import CreateProjectModal from "../shared/modals/create-project-modal";

type PaletteActionItem = {
  icon?: ComponentType<{ className?: string }>;
  value: string;
  label: string;
  badge?: string;
  shortcutId?: ShortcutId;
  onRun: () => void;
};

type PaletteGroup = {
  value: string;
  label: string;
  items: PaletteActionItem[];
};

function CommandPalette() {
  const { t } = useTranslation();
  const { setTheme } = useUserPreferencesStore();
  const navigate = useNavigate();
  const location = useLocation();
  const { data: workspace } = useActiveWorkspace();
  const { data: session } = authClient.useSession();
  const { data: config } = useGetConfig();
  const isAdmin = hasInstanceAdminRole(session?.user?.role);
  const canCreateWorkspace =
    isAdmin || (config !== undefined && !config.disableWorkspaceCreation);
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const { data: searchData } = useGlobalSearch({
    q: query,
    type: "tasks",
    workspaceId: workspace?.id,
    limit: 8,
  });
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const isCreateTaskOpen = useCreateIssueStore((state) => state.open);
  const setIsCreateTaskOpen = useCreateIssueStore((state) => state.setOpen);
  const createIssueDraft = useCreateIssueStore((state) => state.draft);
  const savedDraft = useCreateIssueStore((state) => state.savedDraft);
  const [isCreateProjectOpen, setIsCreateProjectOpen] = useState(false);
  const [isCreateWorkspaceOpen, setIsCreateWorkspaceOpen] = useState(false);
  const projectIdFromRoute =
    location.pathname.match(/\/project\/([^/]+)/)?.[1] ?? undefined;
  const isBacklogView = location.pathname.endsWith("/backlog");

  const openShortcutsPanel = useShortcutsPanelStore((state) => state.setOpen);

  useShortcut("openCommandMenu", () => setOpen((prev) => !prev));
  useShortcut("createTask", () => setIsCreateTaskOpen(true));
  useShortcut("createProject", () => setIsCreateProjectOpen(true));

  const runCommand = useCallback((command: () => void) => {
    command();
    setOpen(false);
  }, []);

  const issueItems = useMemo<PaletteActionItem[]>(() => {
    if (query.trim().length < 3) return [];
    const results = (searchData?.results ?? []) as {
      id: string;
      title: string;
      type: string;
      projectId?: string;
      taskNumber?: number;
      projectSlug?: string;
      archivedAt?: string | null;
    }[];
    return results
      .filter((r) => r.type === "task" && r.projectId && workspace?.id)
      .map((r) => ({
        // Starts with the query so the palette's own filter keeps the row.
        value: `${query} ${r.id}`,
        label: `${r.projectSlug ?? ""}-${r.taskNumber ?? ""} ${r.title}`.trim(),
        badge: r.archivedAt ? t("tasks:detail.archived.badge") : undefined,
        onRun: () =>
          navigate({
            to: "/dashboard/workspace/$workspaceId/project/$projectId/task/$taskId",
            params: {
              workspaceId: workspace?.id ?? "",
              projectId: r.projectId ?? "",
              taskId: r.id,
            },
          }),
      }));
  }, [query, searchData?.results, navigate, workspace?.id, t]);

  const groupedItems = useMemo<PaletteGroup[]>(
    () => [
      ...(issueItems.length
        ? [
            {
              value: "issues",
              label: t("navigation:search.groups.task"),
              items: issueItems,
            },
          ]
        : []),
      {
        value: "issues",
        label: t("navigation:commandPalette.issues"),
        items: [
          {
            value: "create-task",
            icon: PlusIcon,
            label: t("navigation:commandPalette.createTask"),
            shortcutId: "createTask",
            onRun: () => setIsCreateTaskOpen(true),
          },
        ],
      },
      {
        value: "projects-group",
        label: t("navigation:commandPalette.projects"),
        items: [
          {
            value: "create-project",
            icon: BoxIcon,
            label: t("navigation:commandPalette.createProject"),
            shortcutId: "createProject",
            onRun: () => setIsCreateProjectOpen(true),
          },
        ],
      },
      {
        value: "navigation",
        label: t("navigation:commandPalette.navigation"),
        items: [
          ...(
            [
              ["inbox", InboxIcon, "goToInbox", "/inbox"],
              ["my-issues", UserIcon, "goToMyTasks", "/my-tasks"],
              ["projects", BoxIcon, "goToProjects", "/work-projects"],
              ["members", UsersIcon, undefined, "/members"],
            ] as const
          ).map(([key, icon, shortcutId, path]) => ({
            value: `go-${key}`,
            icon,
            label: t(`navigation:commandPalette.go.${key}`),
            shortcutId,
            onRun: () => {
              if (!workspace?.id) return;
              navigate({
                to: `/dashboard/workspace/$workspaceId${path}`,
                params: { workspaceId: workspace.id },
              });
            },
          })),
          {
            value: "go-settings",
            icon: SettingsIcon,
            label: t("navigation:commandPalette.go.settings"),
            shortcutId: "goToSettings",
            onRun: () =>
              navigate({ to: "/dashboard/settings/account/information" }),
          },
        ],
      },
      {
        value: "commands",
        label: t("navigation:commandPalette.commands"),
        items: [
          ...(canCreateWorkspace
            ? [
                {
                  value: "create-workspace",
                  label: t("navigation:commandPalette.createWorkspace"),
                  onRun: () => setIsCreateWorkspaceOpen(true),
                },
              ]
            : []),
          {
            value: "theme-light",
            label: t("navigation:commandPalette.lightTheme"),
            onRun: () => setTheme("light"),
          },
          {
            value: "theme-dark",
            label: t("navigation:commandPalette.darkTheme"),
            onRun: () => setTheme("dark"),
          },
          {
            value: "theme-system",
            label: t("navigation:commandPalette.systemTheme"),
            onRun: () => setTheme("system"),
          },
          {
            value: "keyboard-shortcuts",
            label: t("navigation:commandPalette.keyboardShortcuts"),
            shortcutId: "openShortcuts",
            onRun: () => openShortcutsPanel(true),
          },
        ],
      },
    ],
    [
      issueItems,
      navigate,
      setTheme,
      t,
      workspace?.id,
      canCreateWorkspace,
      openShortcutsPanel,
      setIsCreateTaskOpen,
    ],
  );

  return (
    <>
      <CommandDialog
        open={open}
        onOpenChange={(next) => {
          setOpen(next);
          if (!next) setQuery("");
        }}
      >
        <CommandDialogPopup instant finalFocus={false}>
          <Command items={groupedItems}>
            <CommandInput
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder={t("navigation:commandPalette.inputPlaceholder")}
            />
            <CommandPanel>
              <CommandEmpty>
                {t("navigation:commandPalette.empty")}
              </CommandEmpty>
              <CommandList>
                {(group: PaletteGroup, groupIndex: number) => (
                  <Fragment key={group.value}>
                    <CommandGroup items={group.items}>
                      <CommandGroupLabel>{group.label}</CommandGroupLabel>
                      <CommandCollection>
                        {(item: PaletteActionItem) => {
                          return (
                            <CommandItem
                              key={item.value}
                              value={item.value}
                              onClick={() => runCommand(item.onRun)}
                              className="px-3"
                            >
                              {item.icon && (
                                <item.icon className="size-4 text-muted-foreground" />
                              )}
                              <span className="flex-1">{item.label}</span>
                              {item.badge && (
                                <span className="rounded bg-muted px-1.5 py-0.5 text-[10px] text-muted-foreground">
                                  {item.badge}
                                </span>
                              )}
                              {item.shortcutId && (
                                <CommandShortcut>
                                  <ShortcutKeys
                                    id={item.shortcutId}
                                    tone="muted"
                                  />
                                </CommandShortcut>
                              )}
                            </CommandItem>
                          );
                        }}
                      </CommandCollection>
                    </CommandGroup>
                    {groupIndex < groupedItems.length - 1 && (
                      <CommandSeparator />
                    )}
                  </Fragment>
                )}
              </CommandList>
            </CommandPanel>
            <CommandFooter>
              <div className="flex items-center gap-4">
                <div className="flex items-center gap-2">
                  <KbdGroup>
                    <Kbd>
                      <ArrowUpIcon />
                    </Kbd>
                    <Kbd>
                      <ArrowDownIcon />
                    </Kbd>
                  </KbdGroup>
                  <span>{t("navigation:commandPalette.footer.navigate")}</span>
                </div>
                <div className="flex items-center gap-2">
                  <Kbd>
                    <CornerDownLeftIcon />
                  </Kbd>
                  <span>{t("navigation:commandPalette.footer.open")}</span>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Kbd>Esc</Kbd>
                <span>{t("navigation:commandPalette.footer.close")}</span>
              </div>
            </CommandFooter>
          </Command>
        </CommandDialogPopup>
      </CommandDialog>

      <SearchCommandMenu open={isSearchOpen} setOpen={setIsSearchOpen} />
      <CreateTaskModal
        open={isCreateTaskOpen}
        projectId={createIssueDraft?.projectId ?? projectIdFromRoute}
        prefill={createIssueDraft ?? undefined}
        savedDraft={savedDraft ?? undefined}
        status={isBacklogView ? "planned" : undefined}
        onClose={() => setIsCreateTaskOpen(false)}
        instant
      />
      <CreateWorkspaceModal
        open={isCreateWorkspaceOpen}
        onClose={() => setIsCreateWorkspaceOpen(false)}
      />
      <CreateProjectModal
        open={isCreateProjectOpen}
        onClose={() => setIsCreateProjectOpen(false)}
      />
    </>
  );
}

export default CommandPalette;
