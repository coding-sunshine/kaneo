import { useMutation, useQueryClient } from "@tanstack/react-query";
import { ShieldOffIcon } from "lucide-react";
import { useTranslation } from "react-i18next";
import { resetAdminUserTwoFactor } from "@/fetchers/admin/reset-admin-user-two-factor";
import {
  ADMIN_USERS_QUERY_KEY,
  type AdminUser,
} from "@/hooks/queries/admin/use-admin-users";
import { toast } from "@/lib/toast";

function useResetAdminUserTwoFactor() {
  const { t } = useTranslation();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (user: Pick<AdminUser, "id" | "email">) =>
      resetAdminUserTwoFactor(user.id),
    onSuccess: (_result, user) => {
      toast.success(
        t("settings:adminUsers.toast.twoFactorReset", { email: user.email }),
        { icon: ShieldOffIcon },
      );
      queryClient.invalidateQueries({ queryKey: ADMIN_USERS_QUERY_KEY });
    },
    onError: (error) => {
      toast.error(
        error instanceof Error && error.message
          ? error.message
          : t("settings:adminUsers.toast.actionError"),
      );
    },
  });
}

export default useResetAdminUserTwoFactor;
