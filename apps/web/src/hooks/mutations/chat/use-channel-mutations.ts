import { useMutation, useQueryClient } from "@tanstack/react-query";
import {
  addChannelMember,
  createChannel,
  joinChannel,
  leaveChannel,
  markChannelRead,
  updateChannel,
} from "@/fetchers/chat/channels";
import { channelKey } from "@/hooks/queries/chat/use-channel";
import { channelsKey } from "@/hooks/queries/chat/use-channels";

export function useCreateChannel(workspaceId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: Parameters<typeof createChannel>[1]) =>
      createChannel(workspaceId, input),
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: channelsKey(workspaceId) }),
  });
}

// Every channel change can move it in or out of the sidebar and directory.
function useChannelMutation<TInput, TResult>(
  workspaceId: string,
  channelId: string,
  run: (
    param: { workspaceId: string; channelId: string },
    input: TInput,
  ) => Promise<TResult>,
) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: TInput) => run({ workspaceId, channelId }, input),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: channelsKey(workspaceId) });
      queryClient.invalidateQueries({
        queryKey: channelKey(workspaceId, channelId),
      });
    },
  });
}

export const useUpdateChannel = (workspaceId: string, channelId: string) =>
  useChannelMutation(workspaceId, channelId, updateChannel);

export const useJoinChannel = (workspaceId: string, channelId: string) =>
  useChannelMutation(workspaceId, channelId, (param) => joinChannel(param));

export const useLeaveChannel = (workspaceId: string, channelId: string) =>
  useChannelMutation(workspaceId, channelId, (param) => leaveChannel(param));

export const useAddChannelMember = (workspaceId: string, channelId: string) =>
  useChannelMutation(workspaceId, channelId, addChannelMember);

// Reading changes only your own unread counts.
export function useMarkChannelRead(workspaceId: string, channelId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => markChannelRead({ workspaceId, channelId }),
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: channelsKey(workspaceId) }),
  });
}
