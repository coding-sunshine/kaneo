import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { renderHook, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vite-plus/test";
import type { DocumentDetail } from "@/fetchers/document/documents";
import { documentKey } from "@/hooks/queries/document/use-documents";
import {
  useCreateDocument,
  useMoveDocumentPage,
} from "./use-document-mutations";

const createDocument = vi.fn();
const moveDocumentPage = vi.fn();
vi.mock("@/fetchers/document/documents", () => ({
  createDocument: (...args: unknown[]) => createDocument(...args),
  moveDocumentPage: (...args: unknown[]) => moveDocumentPage(...args),
}));

const page = (id: string, extra: Partial<DocumentDetail> = {}) =>
  ({ id, hasChildren: false, ancestors: [], ...extra }) as DocumentDetail;

let queryClient: QueryClient;
const wrapper = ({ children }: { children: ReactNode }) => (
  <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
);
const cached = (id: string) =>
  queryClient.getQueryData<DocumentDetail>(documentKey("ws", id));

describe("page tree cache", () => {
  beforeEach(() => {
    queryClient = new QueryClient();
    createDocument.mockReset();
    moveDocumentPage.mockReset();
  });

  it("marks the parent as having pages once a child is added", async () => {
    queryClient.setQueryData(documentKey("ws", "handbook"), page("handbook"));
    createDocument.mockResolvedValue(
      page("onboarding", {
        ancestors: [{ id: "handbook", title: "Handbook" }],
      }),
    );
    const { result } = renderHook(() => useCreateDocument("ws"), { wrapper });

    await result.current.mutateAsync({ parentDocumentId: "handbook" });

    expect(cached("handbook")?.hasChildren).toBe(true);
    await waitFor(() =>
      expect(
        queryClient.getQueryState(documentKey("ws", "handbook"))?.isInvalidated,
      ).toBe(true),
    );
  });

  it("marks the new parent and refetches the old one on a move", async () => {
    queryClient.setQueryData(documentKey("ws", "a"), page("a"));
    queryClient.setQueryData(
      documentKey("ws", "b"),
      page("b", { hasChildren: true }),
    );
    queryClient.setQueryData(
      documentKey("ws", "child"),
      page("child", { ancestors: [{ id: "b", title: "B" }] }),
    );
    moveDocumentPage.mockResolvedValue(
      page("child", { ancestors: [{ id: "a", title: "A" }] }),
    );
    const { result } = renderHook(() => useMoveDocumentPage("ws"), {
      wrapper,
    });

    await result.current.mutateAsync({ id: "child", parentDocumentId: "a" });

    expect(cached("a")?.hasChildren).toBe(true);
    expect(
      queryClient.getQueryState(documentKey("ws", "b"))?.isInvalidated,
    ).toBe(true);
  });
});
