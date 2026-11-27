import { useQuery } from "@tanstack/react-query";
import useAuth from "@/components/providers/auth-provider/hooks/use-auth";
import { getAdminBackups } from "@/fetchers/admin/get-admin-backups";

export const ADMIN_BACKUPS_QUERY_KEY = ["admin", "backups"] as const;

function useAdminBackups() {
  const { user } = useAuth();
  const userId = user?.id ?? "";
  return useQuery({
    queryKey: [...ADMIN_BACKUPS_QUERY_KEY, userId],
    queryFn: getAdminBackups,
    enabled: userId !== "",
  });
}

export default useAdminBackups;
