import { useQuery } from "@tanstack/react-query";
import getEmailIntake from "@/fetchers/email-intake/get-email-intake";

export function useEmailIntake(projectId: string) {
  return useQuery({
    queryKey: ["email-intake", projectId],
    queryFn: () => getEmailIntake(projectId),
    enabled: Boolean(projectId),
  });
}
