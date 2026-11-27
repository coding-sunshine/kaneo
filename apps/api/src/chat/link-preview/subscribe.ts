import { subscribeToEvent } from "../../events";
import { attachLinkPreview } from "./attach-link-preview";

// Runs after the post returns, so a slow site never delays the message.
subscribeToEvent<{ workspaceId: string; channelId: string; messageId: string }>(
  "chat.message_created",
  attachLinkPreview,
);
