import { cleanup, render, screen } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, describe, expect, it, vi } from "vite-plus/test";
import { TopicsStrip } from "./topics-strip";

vi.mock("react-i18next", () => ({
  useTranslation: () => ({ t: (key: string) => key }),
  initReactI18next: { type: "3rdParty", init: () => {} },
}));
vi.mock("@tanstack/react-router", () => ({
  Link: ({ children }: { children: ReactNode }) => (
    <a href="/topic">{children}</a>
  ),
}));
vi.mock("./new-topic-dialog", () => ({ NewTopicDialog: () => null }));
vi.mock("@/hooks/queries/topic/use-topics", () => ({
  useTopics: () => ({
    data: [
      { id: "t1", name: "Pricing", scope: "workspace", parentName: null },
      { id: "t2", name: "Hiring", scope: "team", parentName: "Alpha" },
    ],
  }),
}));

afterEach(cleanup);

describe("TopicsStrip", () => {
  it("says who can open each topic", () => {
    render(<TopicsStrip workspaceId="ws" />);
    const pricing = screen.getByRole("link", { name: /Pricing/ });
    expect(pricing.textContent).toContain(
      "navigation:documents.accessLabel.workspace",
    );
    const hiring = screen.getByRole("link", { name: /Hiring/ });
    expect(hiring.textContent).toContain("Alpha");
    expect(hiring.textContent).toContain(
      "navigation:documents.accessLabel.team:",
    );
  });
});
