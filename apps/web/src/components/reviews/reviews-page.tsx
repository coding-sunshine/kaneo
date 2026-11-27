import { useParams } from "@tanstack/react-router";
import { GitPullRequest, ListFilterPlus, Search } from "lucide-react";
import { type ReactNode, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import Layout from "@/components/common/layout";
import PageTitle from "@/components/page-title";
import { ReviewsAdvancedFilterChip } from "@/components/reviews/reviews-advanced-filter-chip";
import { ReviewsConnectCard } from "@/components/reviews/reviews-connect-card";
import { ReviewsDisplayOptions } from "@/components/reviews/reviews-display-options";
import { ReviewsList } from "@/components/reviews/reviews-list";
import { ReviewsTabMenu } from "@/components/reviews/reviews-tab-menu";
import { ReviewsTabPill } from "@/components/reviews/reviews-tab-pill";
import { ActiveFiltersBar } from "@/components/project/task-filters/active-filters-bar";
import { FilterMenu } from "@/components/project/task-filters/filter-menu";
import {
  useReviewsFilterBinder,
  useReviewsFilterSubjects,
} from "@/components/reviews/use-reviews-filter-subjects";
import { Button } from "@/components/ui/button";
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyTitle,
} from "@/components/ui/empty";
import { Input } from "@/components/ui/input";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { Skeleton } from "@/components/ui/skeleton";
import {
  useReviewsList,
  useReviewsStatus,
} from "@/hooks/queries/github-reviews/use-github-reviews";
import { cn } from "@/lib/cn";
import {
  countAdvancedConditions,
  filterByAdvancedFilter,
} from "@/lib/reviews-advanced";
import {
  activeFilterCount,
  filterByReviewFilters,
  REVIEW_FILTER_IDS,
  type ReviewsFilters,
} from "@/lib/reviews-filters";
import {
  buildGroups,
  fetchWindow,
  filterPullRequests,
  moveTab,
  REVIEWS_TABS,
  type ReviewsTab,
  sortPullRequests,
  tabItems,
  visibleRows,
} from "@/lib/reviews-view";
import { splitSnoozed } from "@/lib/reviews-snooze";
import { useReviewsSnoozeStore } from "@/store/reviews-snooze";
import { useUserPreferencesStore } from "@/store/user-preferences";

type DetailParams = { owner?: string; repo?: string; number?: string };

/** Linear's split: the list on the left, the opened pull request (children) beside it. */
export function ReviewsPage({
  returnTo,
  workspaceId,
  children,
}: {
  returnTo: string;
  workspaceId: string;
  children?: ReactNode;
}) {
  const { t } = useTranslation();
  const views = useUserPreferencesStore((state) => state.reviewsView);
  const setView = useUserPreferencesStore((state) => state.setReviewsView);
  const expanded = useUserPreferencesStore((state) => state.reviewsExpanded);
  const tabOrder = useUserPreferencesStore((state) => state.reviewsTabOrder);
  const setTabOrder = useUserPreferencesStore(
    (state) => state.setReviewsTabOrder,
  );
  const [tab, setTab] = useState<ReviewsTab>(() => {
    const linked = new URLSearchParams(window.location.search).get("tab");
    return REVIEWS_TABS.find((entry) => entry === linked) ?? "toReview";
  });
  const [filterOpen, setFilterOpen] = useState(false);
  const [advancedOpen, setAdvancedOpen] = useState(false);
  const [query, setQuery] = useState("");
  const status = useReviewsStatus();
  const connected = status.data?.state === "connected";
  const list = useReviewsList(fetchWindow(views), connected, workspaceId);
  const params = useParams({ strict: false }) as DetailParams;
  const selectedKey = params.number
    ? `${params.owner}/${params.repo}#${params.number}`
    : undefined;

  const title = t("workspace:reviews.pageTitle");
  const view = views[tab];
  const filters = view.filters;
  const setFilters = (next: ReviewsFilters) => setView(tab, { filters: next });
  const data = list.data;
  const me = status.data?.login ?? null;
  // Date presets count back from the last fetch, so they stay stable between renders.
  const updatedAt = list.dataUpdatedAt;
  const ctx = useMemo(
    () => ({ me, now: new Date(updatedAt || Date.now()) }),
    [me, updatedAt],
  );
  const items = useMemo(
    () => (data ? tabItems(data, tab, view) : []),
    [data, tab, view],
  );
  const subjects = useReviewsFilterSubjects(items, filters, setFilters, ctx);
  const bindSubject = useReviewsFilterBinder(items, ctx);
  const advanced = view.advanced;
  const openAdvanced = () => {
    // Linear starts a new advanced filter on "or" and reopens the one already there.
    if (!advanced)
      setView(tab, { advanced: { operator: "or", conditions: [] } });
    setAdvancedOpen(true);
  };
  const snoozes = useReviewsSnoozeStore((state) => state.entries);
  const groups = useMemo(() => {
    if (!data) return [];
    const { active, snoozed } = splitSnoozed(
      sortPullRequests(
        filterPullRequests(
          filterByAdvancedFilter(
            filterByReviewFilters(items, filters, ctx),
            advanced,
            ctx,
          ),
          query,
        ),
        view,
      ),
      snoozes,
    );
    return buildGroups(active, view, view.showSnoozed ? snoozed : []);
  }, [data, items, filters, advanced, ctx, view, query, snoozes]);
  const toReviewCount = useMemo(
    () => (data ? splitSnoozed(data.toReview, snoozes).active.length : 0),
    [data, snoozes],
  );
  const shown = useMemo(
    () => visibleRows(groups, view.collapsed).length,
    [groups, view.collapsed],
  );
  const empty = groups.every((group) => group.items.length === 0);

  const closeFilter = () => {
    setFilterOpen(false);
    setQuery("");
  };

  return (
    <>
      <PageTitle title={title} />
      <div className="flex h-full min-h-0">
        {/* One pane at a time below lg: the list, or the opened pull request. */}
        <div
          className={cn(
            "flex min-h-0 w-full shrink-0 flex-col border-border/60",
            connected && "lg:w-[30.5rem] lg:border-r",
            connected && selectedKey && "max-lg:hidden",
            // Expanded only applies with a pull request open, so the list never vanishes on its own.
            connected && selectedKey && expanded && "lg:hidden",
          )}
        >
          <Layout.Header className="items-center gap-1">
            <SidebarTrigger className="-ml-1 size-6 shrink-0" />
            <h1 className="ml-1 min-w-0 flex-1 truncate font-medium text-[13px]">
              {title}
            </h1>
            {connected && (
              <>
                <FilterMenu
                  subjects={subjects}
                  activeCount={
                    activeFilterCount(filters) +
                    (advanced && countAdvancedConditions(advanced) > 0 ? 1 : 0)
                  }
                  actions={[
                    {
                      value: "advanced",
                      label: t("workspace:reviews.filters.advanced.label"),
                      icon: <ListFilterPlus />,
                      toggle: openAdvanced,
                    },
                  ]}
                />
                <Button
                  variant="ghost"
                  size="icon-sm"
                  aria-label={t("workspace:reviews.searchPlaceholder")}
                  aria-pressed={filterOpen}
                  className="aria-pressed:bg-accent"
                  onClick={() =>
                    filterOpen ? closeFilter() : setFilterOpen(true)
                  }
                >
                  <Search />
                </Button>
                <ReviewsDisplayOptions
                  tab={tab}
                  view={view}
                  onChange={(patch) => setView(tab, patch)}
                />
              </>
            )}
          </Layout.Header>
          {connected && (
            <div
              role="tablist"
              className="flex h-11 shrink-0 items-center gap-1 px-3"
            >
              {tabOrder.map((entry, index) => (
                <ReviewsTabMenu
                  key={entry}
                  tab={entry}
                  first={index === 0}
                  onMove={() =>
                    setTabOrder(moveTab(tabOrder, entry, index === 0 ? 1 : -1))
                  }
                >
                  <ReviewsTabPill
                    active={tab === entry}
                    onClick={() => setTab(entry)}
                  >
                    {t(`workspace:reviews.tabs.${entry}`)}
                    {entry === "toReview" && toReviewCount > 0 && (
                      <span className="text-muted-foreground tabular-nums">
                        {toReviewCount}
                      </span>
                    )}
                  </ReviewsTabPill>
                </ReviewsTabMenu>
              ))}
            </div>
          )}
          {connected && (
            <ActiveFiltersBar
              subjects={subjects}
              onClear={() => {
                setAdvancedOpen(false);
                setView(tab, { filters: {}, advanced: null });
              }}
              extra={
                advanced && (
                  <ReviewsAdvancedFilterChip
                    filter={advanced}
                    bindSubject={bindSubject}
                    subjectIds={REVIEW_FILTER_IDS}
                    open={advancedOpen}
                    onOpenChange={setAdvancedOpen}
                    onChange={(next) => setView(tab, { advanced: next })}
                    onRemove={() => {
                      setAdvancedOpen(false);
                      setView(tab, { advanced: null });
                    }}
                  />
                )
              }
            />
          )}
          {connected && filterOpen && (
            <div className="shrink-0 px-3 pb-2">
              <Input
                type="search"
                autoFocus
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                onKeyDown={(event) => event.key === "Escape" && closeFilter()}
                placeholder={t("workspace:reviews.filterPlaceholder")}
                aria-label={t("workspace:reviews.filterPlaceholder")}
                className="h-7"
              />
            </div>
          )}
          <div className="min-h-0 flex-1 overflow-y-auto">
            {status.isLoading || (connected && list.isLoading) ? (
              <div className="flex flex-col gap-px px-2 py-2">
                {[1, 2, 3, 4].map((row) => (
                  <div
                    key={row}
                    className="flex h-9 items-center gap-2.5 px-2.5"
                  >
                    <Skeleton className="size-4 rounded-full" />
                    <Skeleton className="h-3.5 flex-1" />
                    <Skeleton className="h-3.5 w-8" />
                  </div>
                ))}
              </div>
            ) : status.isError || (connected && list.isError && !list.data) ? (
              <p role="alert" className="p-6 text-muted-foreground text-sm">
                {t("workspace:reviews.loadError")}
              </p>
            ) : status.data && status.data.state !== "connected" ? (
              <ReviewsConnectCard
                state={status.data.state}
                returnTo={returnTo}
              />
            ) : empty ? (
              <Empty className="min-h-[50vh]">
                <EmptyHeader>
                  <EmptyTitle>{t("workspace:reviews.empty.title")}</EmptyTitle>
                  <EmptyDescription>
                    {t("workspace:reviews.empty.description")}
                  </EmptyDescription>
                </EmptyHeader>
              </Empty>
            ) : (
              <ReviewsList
                groups={groups}
                view={view}
                workspaceId={workspaceId}
                selectedKey={selectedKey}
                onViewChange={(patch) => setView(tab, patch)}
              />
            )}
          </div>
        </div>
        {connected && (
          <div
            className={cn("min-w-0 flex-1", !selectedKey && "hidden lg:block")}
          >
            {selectedKey ? (
              children
            ) : (
              <div className="flex h-full flex-col items-center justify-center gap-2 text-center">
                <GitPullRequest
                  aria-hidden
                  className="size-16 text-muted-foreground/40"
                  strokeWidth={1}
                />
                <p className="text-muted-foreground text-sm">
                  {t("workspace:reviews.count", { count: shown })}
                </p>
              </div>
            )}
          </div>
        )}
      </div>
    </>
  );
}
