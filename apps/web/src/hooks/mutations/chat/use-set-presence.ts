import { useMutation, useQueryClient } from "@tanstack/react-query";
import { setPresenceSetting } from "@/fetchers/chat/presence";
import { presenceSettingKey } from "@/hooks/queries/chat/use-presence-setting";

export function useSetPresence() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: setPresenceSetting,
    onSuccess: (setting) => {
      queryClient.setQueryData(presenceSettingKey, setting);
      // Whoever was online is shown, or hidden, from now on.
      queryClient.invalidateQueries({ queryKey: ["chat-online"] });
    },
  });
}
