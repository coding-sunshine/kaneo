import type { QueryClient } from "@tanstack/react-query";

// Lists, details and board cards all embed a project's name or progress.
export function invalidateWorkProjects(queryClient: QueryClient, id?: string) {
  void queryClient.invalidateQueries({ queryKey: ["work-projects"] });
  void queryClient.invalidateQueries({
    queryKey: id ? ["work-project", id] : ["work-project"],
  });
}
