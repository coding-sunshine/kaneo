import { subscribeToEvent } from "../../events";
import { removeFromCall } from "./remove-from-call";
import { removeFromWorkspaceCalls } from "./remove-from-workspace-calls";

subscribeToEvent<{ channelId: string; userId: string }>(
  "chat.member_left",
  ({ channelId, userId }) => removeFromCall(channelId, userId),
);

subscribeToEvent<{ userId: string; workspaceId: string }>(
  "chat.workspace_access_revoked",
  ({ userId, workspaceId }) => removeFromWorkspaceCalls(userId, workspaceId),
);
