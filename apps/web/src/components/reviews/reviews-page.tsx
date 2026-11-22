import { GitPullRequest } from "lucide-react";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import WorkspaceLayout from "@/components/common/workspace-layout";
import PageTitle from "@/components/page-title";
import { ReviewsConnectCard } from "@/components/reviews/reviews-connect-card";
import { ReviewsList } from "@/components/reviews/reviews-list";
import { Button } from "@/components/ui/button";
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty";
import { Skeleton } from "@/components/ui/skeleton";
import {
  useReviewsList,
  useReviewsStatus,
} from "@/hooks/queries/github-reviews/use-github-reviews";
import { cn } from "@/lib/cn";
import { useUserPreferencesStore } from "@/store/user-preferences";

type ReviewsTab = "created" | "toReview";

function Pill({
  active,
  onClick,
  role,
  children,
}: {
  active: boolean;
  onClick: () => void;
  role?: "tab";
  children: React.ReactNode;
}) {
  return (
    <Button
      role={role}
      aria-selected={role === "tab" ? active : undefined}
      aria-pressed={role === "tab" ? undefined : active}
      variant="outline"
      size="xs"
      onClick={onClick}
      className={cn(
        "rounded-full",
        active ? "bg-accent text-foreground" : "text-muted-foreground",
      )}
    >
      {children}
    </Button>
  );
}

export function ReviewsPage({
  returnTo,
  workspaceId,
}: {
  returnTo: string;
  workspaceId: string;
}) {
  const { t } = useTranslation();
  const setCodeReviewsEnabled = useUserPreferencesStore(
    (state) => state.setCodeReviewsEnabled,
  );
  const [tab, setTab] = useState<ReviewsTab>("toReview");
  const [includeDrafts, setIncludeDrafts] = useState(false);
  const [includeClosed, setIncludeClosed] = useState(false);
  const status = useReviewsStatus();
  const connected = status.data?.state === "connected";
  const list = useReviewsList({ includeDrafts, includeClosed }, connected);

  const title = t("workspace:reviews.pageTitle");
  const pullRequests = list.data
    ? tab === "created"
      ? list.data.created
      : [...list.data.toReview, ...list.data.participated]
    : [];

  return (
    <>
      <PageTitle title={title} />
      <WorkspaceLayout
        title={title}
        headerActions={
          <Button
            variant="ghost"
            size="xs"
            onClick={() => setCodeReviewsEnabled(false)}
          >
            {t("workspace:reviews.dismiss")}
          </Button>
        }
      >
        <div className="flex h-full min-h-0 flex-col">
          {connected && (
            <div className="flex h-11 shrink-0 items-center justify-between border-border/50 border-b px-4">
              <div role="tablist" className="inline-flex items-center gap-1.5">
                <Pill
                  role="tab"
                  active={tab === "created"}
                  onClick={() => setTab("created")}
                >
                  {t("workspace:reviews.tabs.created")}
                </Pill>
                <Pill
                  role="tab"
                  active={tab === "toReview"}
                  onClick={() => setTab("toReview")}
                >
                  {t("workspace:reviews.tabs.toReview")}
                </Pill>
              </div>
              <div className="inline-flex items-center gap-1.5">
                <Pill
                  active={includeDrafts}
                  onClick={() => setIncludeDrafts((value) => !value)}
                >
                  {t("workspace:reviews.showDrafts")}
                </Pill>
                <Pill
                  active={includeClosed}
                  onClick={() => setIncludeClosed((value) => !value)}
                >
                  {t("workspace:reviews.showClosed")}
                </Pill>
              </div>
            </div>
          )}
          <div className="min-h-0 flex-1 overflow-y-auto">
            {status.isLoading || (connected && list.isLoading) ? (
              <div className="flex flex-col px-4">
                {[1, 2, 3, 4].map((row) => (
                  <div
                    key={row}
                    className="flex h-10 items-center gap-3 border-border/50 border-b px-1"
                  >
                    <Skeleton className="size-4 rounded-full" />
                    <Skeleton className="h-3.5 flex-1" />
                    <Skeleton className="h-3.5 w-16" />
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
            ) : pullRequests.length === 0 ? (
              <Empty className="min-h-[60vh]">
                <EmptyHeader>
                  <EmptyMedia variant="icon">
                    <GitPullRequest />
                  </EmptyMedia>
                  <EmptyTitle>{t("workspace:reviews.empty.title")}</EmptyTitle>
                  <EmptyDescription>
                    {t("workspace:reviews.empty.description")}
                  </EmptyDescription>
                </EmptyHeader>
              </Empty>
            ) : (
              <ReviewsList
                pullRequests={pullRequests}
                workspaceId={workspaceId}
              />
            )}
          </div>
        </div>
      </WorkspaceLayout>
    </>
  );
}
