import { useNavigate } from "@tanstack/react-router";

type OpenableResult = {
  id: string;
  type: string;
  projectId?: string;
  taskId?: string;
  channelId?: string;
};

/** Opens a search result where it lives: a message opens in its channel. */
export function useOpenSearchResult(workspaceId: string | undefined) {
  const navigate = useNavigate();
  return (item: OpenableResult) => {
    switch (item.type) {
      case "task":
        if (item.projectId && workspaceId)
          navigate({
            to: "/dashboard/workspace/$workspaceId/project/$projectId/task/$taskId",
            params: {
              workspaceId,
              projectId: item.projectId,
              taskId: item.id,
            },
          });
        break;
      case "project":
        if (workspaceId)
          navigate({
            to: "/dashboard/workspace/$workspaceId/project/$projectId/board",
            params: { workspaceId, projectId: item.id },
          });
        break;
      case "workspace":
        navigate({
          to: "/dashboard/workspace/$workspaceId",
          params: { workspaceId: item.id },
        });
        break;
      case "document":
        if (workspaceId)
          navigate({
            to: "/dashboard/workspace/$workspaceId/document/$documentId",
            params: { workspaceId, documentId: item.id },
          });
        break;
      case "comment":
      case "activity":
        if (item.projectId && item.taskId && workspaceId)
          navigate({
            to: "/dashboard/workspace/$workspaceId/project/$projectId/task/$taskId",
            params: {
              workspaceId,
              projectId: item.projectId,
              taskId: item.taskId,
            },
          });
        break;
      case "message":
        if (item.channelId && workspaceId)
          navigate({
            to: "/dashboard/workspace/$workspaceId/channels/$channelId",
            params: { workspaceId, channelId: item.channelId },
            search: { messageId: item.id },
          });
        break;
      case "person":
        if (workspaceId)
          navigate({
            to: "/dashboard/workspace/$workspaceId/members",
            params: { workspaceId },
          });
        break;
    }
  };
}
