import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vite-plus/test";
import type { DocumentDetail } from "@/fetchers/document/documents";
import { DocumentStatusBanner } from "./document-status-banner";

vi.mock("react-i18next", () => ({
  useTranslation: () => ({ t: (key: string) => key }),
  initReactI18next: { type: "3rdParty", init: () => {} },
}));

type Labels = Pick<DocumentDetail, "kind" | "status" | "sourceClient">;

const show = (labels: Partial<Labels> = {}) => {
  render(
    <DocumentStatusBanner
      document={{
        kind: "unsorted",
        status: "draft",
        sourceClient: null,
        ...labels,
      }}
    />,
  );
  return screen.getByRole("status").textContent;
};
const banner = (name: string) => [
  `navigation:documents.banner.${name}.lead`,
  `navigation:documents.banner.${name}.detail`,
];

describe("DocumentStatusBanner", () => {
  afterEach(cleanup);

  it("says a new document is a draft", () => {
    const text = show();
    for (const key of banner("draft")) expect(text).toContain(key);
    expect(text).not.toContain("savedFrom");
  });

  it("says a brainstorm is not a decision", () => {
    const text = show({ kind: "brainstorm" });
    for (const key of banner("brainstorm")) expect(text).toContain(key);
    expect(text).not.toContain("banner.draft");
  });

  it("lets the status speak once a document has left draft", () => {
    for (const status of ["in_review", "current", "superseded"] as const) {
      const text = show({ kind: "brainstorm", status });
      for (const key of banner(status)) expect(text).toContain(key);
      expect(text).not.toContain("banner.brainstorm");
      cleanup();
    }
  });

  it("names the assistant a document was saved from", () => {
    expect(show({ sourceClient: "chatgpt" })).toContain(
      "navigation:documents.savedFrom.chatgpt",
    );
    cleanup();
    expect(show({ sourceClient: "claude" })).toContain(
      "navigation:documents.savedFrom.claude",
    );
    cleanup();
    // Typed in the app: nothing to say.
    expect(show({ sourceClient: "web" })).not.toContain("savedFrom");
  });
});
