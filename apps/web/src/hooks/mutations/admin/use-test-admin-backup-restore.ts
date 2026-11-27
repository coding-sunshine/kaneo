import { useMutation } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { testAdminBackupRestore } from "@/fetchers/admin/test-admin-backup-restore";
import { toast } from "@/lib/toast";

function useTestAdminBackupRestore() {
  const { t } = useTranslation();

  return useMutation({
    mutationFn: testAdminBackupRestore,
    onError: (error) => {
      toast.error(
        error instanceof Error && error.message
          ? error.message
          : t("settings:adminBackups.restoreTest.error"),
      );
    },
  });
}

export default useTestAdminBackupRestore;
