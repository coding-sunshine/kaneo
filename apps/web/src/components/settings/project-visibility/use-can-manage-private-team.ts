import { useEffect, useState } from "react";
import { useWorkspacePermission } from "@/hooks/use-workspace-permission";

// The same two abilities the API asks for when a team's privacy changes.
export function useCanManagePrivateTeam() {
  const { hasPermission } = useWorkspacePermission();
  const [canManage, setCanManage] = useState(false);

  useEffect(() => {
    let cancelled = false;
    void hasPermission({ project: ["update"], member: ["update"] }).then(
      (ok) => {
        if (!cancelled) setCanManage(ok);
      },
    );
    return () => {
      cancelled = true;
    };
  }, [hasPermission]);

  return canManage;
}
