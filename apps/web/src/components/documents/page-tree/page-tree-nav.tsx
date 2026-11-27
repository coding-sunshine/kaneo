import {
  DndContext,
  type DragEndEvent,
  MouseSensor,
  pointerWithin,
  TouchSensor,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import { useParams } from "@tanstack/react-router";
import { ChevronRight, Plus } from "lucide-react";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import {
  Collapsible,
  CollapsiblePanel,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import {
  SidebarGroup,
  SidebarGroupAction,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
} from "@/components/ui/sidebar";
import { useMoveDocumentPage } from "@/hooks/mutations/document/use-document-mutations";
import { usePageTree } from "@/hooks/queries/document/use-documents";
import { toast } from "@/lib/toast";
import { useUserPreferencesStore } from "@/store/user-preferences";
import { useNewDocument } from "../use-new-document";
import { buildPageTree, dropParent } from "./build-page-tree";
import { PageTreeItem } from "./page-tree-item";
import { PageTreeTopDrop } from "./page-tree-top-drop";

/** The Pages section of the sidebar: every page you can open, nested. */
export function PageTreeNav({ workspaceId }: { workspaceId: string }) {
  const { t } = useTranslation();
  const { documentId } = useParams({ strict: false });

  const move = useMoveDocumentPage(workspaceId);
  const { create } = useNewDocument(workspaceId);
  const collapsedNavIds = useUserPreferencesStore((s) => s.collapsedNavIds);
  const setNavOpen = useUserPreferencesStore((s) => s.setNavOpen);
  const open = !collapsedNavIds.includes("pages");
  // Only fetched while the section is open.
  const { data: rows = [] } = usePageTree(workspaceId, open);
  const [collapsed, setCollapsed] = useState(() => new Set<string>());
  const [dragging, setDragging] = useState(false);
  // Below these thresholds a press still opens the page.
  const sensors = useSensors(
    useSensor(MouseSensor, { activationConstraint: { distance: 8 } }),
    useSensor(TouchSensor, {
      activationConstraint: { delay: 200, tolerance: 8 },
    }),
  );

  const toggle = (id: string) =>
    setCollapsed((current) => {
      const next = new Set(current);
      if (!next.delete(id)) next.add(id);
      return next;
    });

  const addChild = (parentDocumentId: string) => {
    setCollapsed((current) => {
      const next = new Set(current);
      next.delete(parentDocumentId);
      return next;
    });
    create({ parentDocumentId });
  };

  const onDragEnd = ({ active, over }: DragEndEvent) => {
    setDragging(false);
    if (!over) return;
    const parentDocumentId = dropParent(
      rows,
      String(active.id),
      String(over.id),
    );
    if (parentDocumentId === undefined) return;
    move.mutate(
      { id: String(active.id), parentDocumentId },
      { onError: (error) => toast.error(error.message) },
    );
  };

  return (
    <Collapsible
      open={open}
      onOpenChange={(open) => setNavOpen("pages", open)}
      className="group/collapsible"
    >
      <SidebarGroup className="group-data-[collapsible=icon]:hidden gap-1 p-2 pt-1">
        <CollapsibleTrigger
          className="data-panel-open:[&_svg]:rotate-90"
          render={
            <SidebarGroupLabel className="h-7 cursor-pointer justify-start gap-1 px-2 text-xs text-sidebar-foreground" />
          }
        >
          <span>{t("navigation:documents.pageTree.title")}</span>
          <ChevronRight className="h-3 w-3 text-sidebar-foreground/60 transition-transform duration-200" />
        </CollapsibleTrigger>
        <SidebarGroupAction
          className="top-1.5 right-2 text-sidebar-foreground/70"
          title={t("navigation:documents.pageTree.addPage")}
          onClick={() => create()}
        >
          <Plus />
          <span className="sr-only">
            {t("navigation:documents.pageTree.addPage")}
          </span>
        </SidebarGroupAction>
        <CollapsiblePanel className="-m-1 p-1">
          <SidebarGroupContent>
            <DndContext
              sensors={sensors}
              collisionDetection={pointerWithin}
              onDragStart={() => setDragging(true)}
              onDragCancel={() => setDragging(false)}
              onDragEnd={onDragEnd}
            >
              <SidebarMenu className="gap-px">
                {buildPageTree(rows).map((node) => (
                  <PageTreeItem
                    key={node.id}
                    workspaceId={workspaceId}
                    node={node}
                    depth={0}
                    currentId={documentId}
                    collapsed={collapsed}
                    onToggle={toggle}
                    onAddChild={addChild}
                  />
                ))}
              </SidebarMenu>
              {dragging && <PageTreeTopDrop />}
              {rows.length === 0 && (
                <p className="px-2 py-1 text-sidebar-foreground/60 text-xs">
                  {t("navigation:documents.pageTree.empty")}
                </p>
              )}
            </DndContext>
          </SidebarGroupContent>
        </CollapsiblePanel>
      </SidebarGroup>
    </Collapsible>
  );
}
