import { arrayMove } from "@dnd-kit/sortable";
import { useTranslation } from "react-i18next";
import { SortableList } from "@/components/project/sortable/sortable-list";
import { CustomizeSidebarRow } from "@/components/sidebar-customize/customize-sidebar-row";
import {
  orderItems,
  type SidebarSection,
} from "@/components/sidebar-customize/sidebar-items";
import type { SidebarNavItem } from "@/components/sidebar-customize/use-sidebar-items";
import { useUserPreferencesStore } from "@/store/user-preferences";

const HEADINGS = {
  personal: "navigation:customizeSidebar.personal",
  workspace: "navigation:customizeSidebar.workspace",
} as const satisfies Record<SidebarSection, string>;

export function CustomizeSidebarSection({
  section,
  items,
}: {
  section: SidebarSection;
  items: SidebarNavItem[];
}) {
  const { t } = useTranslation();
  const saved = useUserPreferencesStore(
    (state) => state.sidebar.order[section],
  );
  const setOrder = useUserPreferencesStore((state) => state.setSidebarOrder);
  const ids = orderItems(section, items, saved).map((item) => item.id);
  const byId = new Map(items.map((item) => [item.id, item]));

  return (
    <section className="flex flex-col gap-2">
      <h3 className="font-medium text-sm">{t(HEADINGS[section])}</h3>
      <div className="flex flex-col overflow-hidden rounded-lg border bg-card py-1.5">
        <SortableList
          ids={ids}
          onMove={(from, to) => setOrder(section, arrayMove(ids, from, to))}
        >
          {ids.map((id) => {
            const item = byId.get(id);
            return item ? <CustomizeSidebarRow key={id} item={item} /> : null;
          })}
        </SortableList>
      </div>
    </section>
  );
}
