import { useDroppable } from "@dnd-kit/core";
import { useTranslation } from "react-i18next";
import { cn } from "@/lib/cn";
import { ROOT_DROP_ID } from "./build-page-tree";

/** Below the tree while a page is dragged: drop it here to put it on top. */
export function PageTreeTopDrop() {
  const { t } = useTranslation();
  const { setNodeRef, isOver } = useDroppable({ id: ROOT_DROP_ID });
  return (
    <div
      ref={setNodeRef}
      className={cn(
        "mt-1 rounded-md border border-dashed border-sidebar-border px-2 py-1 text-sidebar-foreground/60 text-xs",
        isOver && "border-sidebar-ring text-sidebar-foreground",
      )}
    >
      {t("navigation:documents.pageTree.dropTop")}
    </div>
  );
}
