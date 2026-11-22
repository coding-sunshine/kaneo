import { createFileRoute } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import { AgentPage } from "@/components/agent/agent-page";
import { AgentTitle } from "@/components/agent/agent-title";
import WorkspaceLayout from "@/components/common/workspace-layout";
import PageTitle from "@/components/page-title";
import { useAgentChat, useHasAgent } from "@/hooks/queries/agent/use-agent";

export const Route = createFileRoute(
  "/_layout/_authenticated/dashboard/workspace/$workspaceId/agent",
)({
  validateSearch: (search: Record<string, unknown>) => ({
    chat: typeof search.chat === "string" ? search.chat : undefined,
  }),
  component: RouteComponent,
});

function RouteComponent() {
  const { t } = useTranslation();
  const { workspaceId } = Route.useParams();
  const { chat } = Route.useSearch();
  const hasAgent = useHasAgent();
  const { data } = useAgentChat(workspaceId, chat);

  if (!hasAgent) return null;

  return (
    <>
      <PageTitle title={t("navigation:sidebar.agent")} />
      <WorkspaceLayout
        title={t("navigation:sidebar.agent")}
        crumbs={
          <AgentTitle
            workspaceId={workspaceId}
            title={data?.title ?? t("navigation:agent.newChat")}
          />
        }
      >
        <AgentPage
          key={chat ?? "new"}
          workspaceId={workspaceId}
          chatId={chat}
        />
      </WorkspaceLayout>
    </>
  );
}
