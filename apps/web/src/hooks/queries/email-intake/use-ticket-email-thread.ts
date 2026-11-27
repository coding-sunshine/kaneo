import { useQuery } from "@tanstack/react-query";
import getTicketEmailThread from "@/fetchers/email-intake/get-ticket-email-thread";

export function useTicketEmailThread(taskId: string) {
  return useQuery({
    queryKey: ["ticket-email-thread", taskId],
    queryFn: () => getTicketEmailThread(taskId),
    enabled: Boolean(taskId),
  });
}
