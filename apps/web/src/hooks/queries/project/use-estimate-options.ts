import useActiveWorkspace from "@/hooks/queries/workspace/use-active-workspace";
import useGetProject from "./use-get-project";

/** The team's estimate scale; empty while estimates are off. */
export function useEstimateOptions(projectId: string) {
  const { data: workspace } = useActiveWorkspace();
  const { data: project } = useGetProject({
    id: projectId,
    workspaceId: workspace?.id ?? "",
  });
  return project?.estimateType && project.estimateType !== "none"
    ? (project.estimateOptions ?? [])
    : [];
}
