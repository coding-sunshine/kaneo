import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { Box, Inbox, Users } from "lucide-react";
import { afterEach, beforeEach, describe, expect, it } from "vite-plus/test";
import { useUserPreferencesStore } from "@/store/user-preferences";
import { CustomizeSidebarDialog } from "./customize-sidebar-dialog";
import type { SidebarNavItem } from "./use-sidebar-items";

const row = (
  id: SidebarNavItem["id"],
  title: string,
  icon: SidebarNavItem["icon"],
): SidebarNavItem => ({ id, title, icon, url: `/${id}` });

const defaultSidebar = useUserPreferencesStore.getState().sidebar;
beforeEach(() => useUserPreferencesStore.setState({ sidebar: defaultSidebar }));
afterEach(cleanup);

const renderDialog = () =>
  render(
    <CustomizeSidebarDialog
      open
      onOpenChange={() => {}}
      personal={[row("inbox", "Inbox", Inbox)]}
      workspace={[
        row("projects", "Projects", Box),
        row("members", "Members", Users),
      ]}
    />,
  );

const pick = async (trigger: HTMLElement, option: RegExp) => {
  fireEvent.click(trigger);
  fireEvent.click(await screen.findByRole("menuitemradio", { name: option }));
};

describe("CustomizeSidebarDialog", () => {
  it("shows each row's visibility and saves a change", async () => {
    renderDialog();
    const triggers = await screen.findAllByRole("button", {
      name: /always show|don't show/i,
    });
    expect(triggers.map((trigger) => trigger.textContent)).toEqual([
      "Always show",
      "Always show",
      "Don't show",
    ]);

    await pick(triggers[2], /always show/i);
    expect(useUserPreferencesStore.getState().sidebar.visibility.members).toBe(
      "always",
    );
  });

  it("offers Show when badged only on rows with a count", async () => {
    renderDialog();
    const [inbox, projects] = await screen.findAllByRole("button", {
      name: /always show/i,
    });
    fireEvent.click(projects);
    expect(
      (await screen.findAllByRole("menuitemradio")).map(
        (item) => item.querySelector(".col-start-1")?.textContent,
      ),
    ).toEqual(["Always show", "Don't show"]);

    await pick(inbox, /show when badged/i);
    expect(useUserPreferencesStore.getState().sidebar.visibility.inbox).toBe(
      "badged",
    );
  });

  it("changes the default badge style", async () => {
    renderDialog();
    await pick(await screen.findByRole("button", { name: /count/i }), /dot/i);
    expect(useUserPreferencesStore.getState().sidebar.badgeStyle).toBe("dot");
  });
});
