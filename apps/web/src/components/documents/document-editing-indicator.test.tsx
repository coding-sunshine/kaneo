import { act, cleanup, render, screen } from "@testing-library/react";
import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "vite-plus/test";
import { documentEditors, EDITING_SHOWN_MS } from "@/lib/document-editors";
import { DocumentEditingIndicator } from "./document-editing-indicator";

vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (key: string, values?: Record<string, string>) =>
      `${key} ${JSON.stringify(values ?? {})}`,
  }),
}));

describe("DocumentEditingIndicator", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });
  afterEach(() => {
    cleanup();
    documentEditors.clear();
    vi.useRealTimers();
  });

  it("names who is typing in this document, then lets the name go", async () => {
    render(<DocumentEditingIndicator documentId="doc-1" />);
    expect(screen.getByRole("status").textContent).toBe("");

    act(() => documentEditors.note("doc-1", "u-2", "Grace"));
    act(() => documentEditors.note("doc-2", "u-3", "Linus"));
    expect(screen.getByRole("status").textContent).toBe(
      'navigation:documents.editing.one {"name":"Grace"}',
    );

    await act(() => vi.advanceTimersByTimeAsync(EDITING_SHOWN_MS + 1));
    expect(screen.getByRole("status").textContent).toBe("");
  });

  it("lists several people once each", () => {
    render(<DocumentEditingIndicator documentId="doc-1" />);
    act(() => {
      documentEditors.note("doc-1", "u-2", "Grace");
      documentEditors.note("doc-1", "u-3", "Linus");
      documentEditors.note("doc-1", "u-2", "Grace");
    });
    expect(screen.getByRole("status").textContent).toBe(
      'navigation:documents.editing.many {"names":"Linus, Grace"}',
    );
  });
});
