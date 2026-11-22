import useGetProjectMembers from "@/hooks/queries/workspace-users/use-get-project-members";

export function TeamMembersCount({
  workspaceId,
  projectId,
}: {
  workspaceId: string;
  projectId: string;
}) {
  const { data } = useGetProjectMembers({ workspaceId, projectId });
  return <>{data?.length ?? ""}</>;
}
