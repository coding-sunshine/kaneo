import { createFileRoute } from "@tanstack/react-router";
import { Plus } from "lucide-react";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { ChannelDirectory } from "@/components/chat/channel-directory";
import { CreateChannelDialog } from "@/components/chat/create-channel-dialog";
import WorkspaceLayout from "@/components/common/workspace-layout";
import PageTitle from "@/components/page-title";
import { Button } from "@/components/ui/button";
import { useChannels } from "@/hooks/queries/chat/use-channels";

export const Route = createFileRoute(
  "/_layout/_authenticated/dashboard/workspace/$workspaceId/channels/",
)({
  component: RouteComponent,
});

function RouteComponent() {
  const { t } = useTranslation();
  const { workspaceId } = Route.useParams();
  const { data: channels = [] } = useChannels(workspaceId);
  const [creating, setCreating] = useState(false);

  return (
    <>
      <PageTitle title={t("navigation:chat.directoryTitle")} />
      <WorkspaceLayout
        title={t("navigation:chat.directoryTitle")}
        headerActions={
          <Button size="sm" variant="outline" onClick={() => setCreating(true)}>
            <Plus />
            {t("navigation:chat.newChannel")}
          </Button>
        }
      >
        <ChannelDirectory workspaceId={workspaceId} channels={channels} />
      </WorkspaceLayout>
      <CreateChannelDialog
        open={creating}
        onOpenChange={setCreating}
        workspaceId={workspaceId}
      />
    </>
  );
}
