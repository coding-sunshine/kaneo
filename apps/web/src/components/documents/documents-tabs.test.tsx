import { render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vite-plus/test";
import { DocumentsTabs } from "./documents-tabs";

vi.mock("react-i18next", () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));
vi.mock("@tanstack/react-router", () => ({ useNavigate: () => vi.fn() }));
vi.mock("@/lib/shortcuts/use-shortcut", () => ({ useShortcut: vi.fn() }));

describe("DocumentsTabs", () => {
  afterEach(() => {
    Reflect.deleteProperty(Element.prototype, "scrollIntoView");
  });

  it("brings the selected tab into view on a narrow screen", () => {
    const scrolled: Element[] = [];
    Element.prototype.scrollIntoView = function scrollIntoView() {
      scrolled.push(this);
    };

    render(<DocumentsTabs workspaceId="w1" value="needsReview" />);

    const selected = screen.getByRole("tab", { selected: true });
    expect(selected.textContent).toBe("navigation:documents.tabs.needsReview");
    expect(scrolled).toEqual([selected]);
  });
});
