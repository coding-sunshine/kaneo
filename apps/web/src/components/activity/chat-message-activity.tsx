import { Link } from "@tanstack/react-router";
import { Trans } from "react-i18next";

// "created this ticket from a chat message" or "added a chat message as a
// comment", with the message linked. A reader outside the channel gets the
// channel's own not-found page.
export default function ChatMessageActivity({
  type,
  workspaceId,
  channelId,
  messageId,
}: {
  type: string;
  workspaceId: string;
  channelId: string;
  messageId: string;
}) {
  return (
    <span className="text-muted-foreground">
      <Trans
        i18nKey={
          type === "created_from_chat_message"
            ? "activity:createdFromChatMessage"
            : "activity:addedChatMessage"
        }
        components={{
          message: (
            <Link
              to="/dashboard/workspace/$workspaceId/channels/$channelId"
              params={{ workspaceId, channelId }}
              search={{ messageId }}
              className="text-foreground underline-offset-2 hover:underline"
            />
          ),
        }}
      />
    </span>
  );
}
