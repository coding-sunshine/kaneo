import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vite-plus/test";
import { DocumentVersionPreview } from "./document-version-preview";

vi.mock("react-i18next", () => ({
  useTranslation: () => ({ t: (key: string) => key }),
  initReactI18next: { type: "3rdParty", init: () => {} },
}));
vi.mock("@/components/activity/comment-editor", () => ({
  default: () => null,
}));

const version = {
  id: "v1",
  title: "Plan",
  content: "",
  updatedAt: "2026-11-20T10:00:00.000Z",
  authorName: "Ana",
} as Parameters<typeof DocumentVersionPreview>[0]["version"];

afterEach(cleanup);

describe("DocumentVersionPreview", () => {
  it("offers a way back to the version list", () => {
    const onBack = vi.fn();
    render(
      <DocumentVersionPreview
        version={version}
        canRestore={false}
        restoring={false}
        onRestore={() => {}}
        onBack={onBack}
      />,
    );
    fireEvent.click(
      screen.getByRole("button", {
        name: "navigation:documents.history.back",
      }),
    );
    expect(onBack).toHaveBeenCalledOnce();
  });
});
