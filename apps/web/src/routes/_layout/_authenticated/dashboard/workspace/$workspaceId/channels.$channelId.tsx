import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import { ChannelView } from "@/components/chat/channel-view";
import WorkspaceLayout from "@/components/common/workspace-layout";
import PageTitle from "@/components/page-title";
import { useChannel } from "@/hooks/queries/chat/use-channel";
import { useDirectMessageTitle } from "@/hooks/use-direct-message-title";

export const Route = createFileRoute(
  "/_layout/_authenticated/dashboard/workspace/$workspaceId/channels/$channelId",
)({
  // A search result opens the channel at one message.
  validateSearch: (search: Record<string, unknown>) => ({
    messageId:
      typeof search.messageId === "string" ? search.messageId : undefined,
  }),
  component: RouteComponent,
});

function RouteComponent() {
  const { t } = useTranslation();
  const { workspaceId, channelId } = Route.useParams();
  const { messageId } = Route.useSearch();
  const navigate = useNavigate({ from: Route.fullPath });
  const { data: channel } = useChannel(workspaceId, channelId);
  const titleOf = useDirectMessageTitle(workspaceId);
  const title = channel?.isDirect
    ? titleOf(channel.memberIds)
    : (channel?.name ?? t("navigation:chat.channels"));

  return (
    <>
      <PageTitle title={title} />
      <WorkspaceLayout title={title}>
        <ChannelView
          key={channelId}
          workspaceId={workspaceId}
          channelId={channelId}
          messageId={messageId}
          onPosted={
            messageId
              ? () => navigate({ search: { messageId: undefined } })
              : undefined
          }
        />
      </WorkspaceLayout>
    </>
  );
}
