import { Target } from "lucide-react";
import { useMemo } from "react";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty";
import { Skeleton } from "@/components/ui/skeleton";
import { useGetInitiatives } from "@/hooks/queries/initiative/use-get-initiatives";
import { useGetActiveWorkspaceUsers } from "@/hooks/queries/workspace-users/use-get-active-workspace-users";
import { InitiativeRow } from "./initiative-row";

export function InitiativeList({ workspaceId }: { workspaceId: string }) {
  const { t } = useTranslation();
  const { data, isLoading, isError, refetch, isFetching } =
    useGetInitiatives(workspaceId);
  const { data: users } = useGetActiveWorkspaceUsers(workspaceId);
  const owners = useMemo(
    () => new Map((users?.members ?? []).map((m) => [m.userId, m.user?.name])),
    [users],
  );

  if (isError && !data) {
    return (
      <div
        role="alert"
        className="flex flex-col items-start gap-2 p-6 text-muted-foreground text-sm"
      >
        <p>{t("workspace:initiative.loadError")}</p>
        <Button
          size="sm"
          variant="outline"
          disabled={isFetching}
          onClick={() => void refetch()}
        >
          {t("tasks:board.tryAgain")}
        </Button>
      </div>
    );
  }

  if (!isLoading && data?.length === 0) {
    return (
      <Empty className="min-h-[60vh]">
        <EmptyHeader>
          <EmptyMedia variant="icon">
            <Target />
          </EmptyMedia>
          <EmptyTitle>{t("workspace:initiative.empty")}</EmptyTitle>
          <EmptyDescription>
            {t("workspace:initiative.emptyDescription")}
          </EmptyDescription>
        </EmptyHeader>
      </Empty>
    );
  }

  return (
    <div className="h-full overflow-y-auto">
      {isLoading
        ? [1, 2, 3].map((row) => (
            <div key={row} className="flex h-12 items-center px-6">
              <Skeleton className="h-3.5 w-64" />
            </div>
          ))
        : data?.map((initiative) => (
            <InitiativeRow
              key={initiative.id}
              initiative={initiative}
              workspaceId={workspaceId}
              ownerName={
                initiative.ownerId ? owners.get(initiative.ownerId) : undefined
              }
            />
          ))}
    </div>
  );
}
