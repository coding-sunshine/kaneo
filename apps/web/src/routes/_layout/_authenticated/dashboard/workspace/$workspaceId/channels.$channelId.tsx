import { createFileRoute } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import { ChannelView } from "@/components/chat/channel-view";
import WorkspaceLayout from "@/components/common/workspace-layout";
import PageTitle from "@/components/page-title";
import { useChannel } from "@/hooks/queries/chat/use-channel";
import { useDirectMessageTitle } from "@/hooks/use-direct-message-title";

export const Route = createFileRoute(
  "/_layout/_authenticated/dashboard/workspace/$workspaceId/channels/$channelId",
)({
  component: RouteComponent,
});

function RouteComponent() {
  const { t } = useTranslation();
  const { workspaceId, channelId } = Route.useParams();
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
        />
      </WorkspaceLayout>
    </>
  );
}
