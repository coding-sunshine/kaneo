import { useQuery } from "@tanstack/react-query";
import { getPresenceSetting } from "@/fetchers/chat/presence";

export const presenceSettingKey = ["chat-presence-setting"];

export function usePresenceSetting() {
  return useQuery({
    queryKey: presenceSettingKey,
    queryFn: getPresenceSetting,
  });
}
