import { useDraggable, useDroppable } from "@dnd-kit/core";
import { Link } from "@tanstack/react-router";
import { ChevronRight, FileText, Plus } from "lucide-react";
import { useTranslation } from "react-i18next";
import { SidebarMenuButton, SidebarMenuItem } from "@/components/ui/sidebar";
import { cn } from "@/lib/cn";
import type { PageNode } from "./build-page-tree";

type PageTreeItemProps = {
  workspaceId: string;
  node: PageNode;
  depth: number;
  currentId?: string;
  collapsed: Set<string>;
  onToggle: (id: string) => void;
  onAddChild: (id: string) => void;
};

const iconButton =
  "flex size-5 shrink-0 items-center justify-center rounded-md text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sidebar-ring [&_svg]:size-3.5";

/** One page in the sidebar tree: drag it onto another page to move it. */
export function PageTreeItem({
  workspaceId,
  node,
  depth,
  currentId,
  collapsed,
  onToggle,
  onAddChild,
}: PageTreeItemProps) {
  const { t } = useTranslation();
  const drag = useDraggable({ id: node.id });
  const drop = useDroppable({ id: node.id });
  const open = !collapsed.has(node.id);
  const title = node.title || t("navigation:documents.untitled");
  return (
    <SidebarMenuItem>
      <div
        ref={(element) => {
          drag.setNodeRef(element);
          drop.setNodeRef(element);
        }}
        {...drag.listeners}
        className={cn(
          "group/page-row relative flex items-center gap-0.5 rounded-[8px]",
          drop.isOver && !drag.isDragging && "ring-1 ring-sidebar-ring",
          drag.isDragging && "opacity-40",
        )}
        style={{ paddingInlineStart: depth * 12 }}
      >
        {node.children.length > 0 ? (
          <button
            type="button"
            className={iconButton}
            aria-label={
              open
                ? t("navigation:documents.pageTree.collapse")
                : t("navigation:documents.pageTree.expand")
            }
            aria-expanded={open}
            onClick={() => onToggle(node.id)}
          >
            <ChevronRight
              aria-hidden
              className={cn("transition-transform", open && "rotate-90")}
            />
          </button>
        ) : (
          <span aria-hidden className="size-5 shrink-0" />
        )}
        <SidebarMenuButton
          isActive={node.id === currentId}
          className="min-w-0 flex-1 pe-7"
          render={
            <Link
              to="/dashboard/workspace/$workspaceId/document/$documentId"
              params={{ workspaceId, documentId: node.id }}
            />
          }
        >
          <FileText aria-hidden />
          <span className="min-w-0 truncate">{title}</span>
        </SidebarMenuButton>
        <button
          type="button"
          className={cn(
            iconButton,
            "absolute end-1 opacity-0 focus-visible:opacity-100 group-hover/page-row:opacity-100",
          )}
          aria-label={t("navigation:documents.pageTree.addChild")}
          onClick={() => onAddChild(node.id)}
        >
          <Plus aria-hidden />
        </button>
      </div>
      {open && node.children.length > 0 && (
        <ul className="flex flex-col gap-px">
          {node.children.map((child) => (
            <PageTreeItem
              key={child.id}
              workspaceId={workspaceId}
              node={child}
              depth={depth + 1}
              currentId={currentId}
              collapsed={collapsed}
              onToggle={onToggle}
              onAddChild={onAddChild}
            />
          ))}
        </ul>
      )}
    </SidebarMenuItem>
  );
}
