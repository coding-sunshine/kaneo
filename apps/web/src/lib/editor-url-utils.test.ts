import { describe, expect, it } from "vite-plus/test";
import { extractDocumentLinkFromUrl } from "./editor-url-utils";

describe("extractDocumentLinkFromUrl", () => {
  it("reads the workspace and the document from a document's address", () => {
    expect(
      extractDocumentLinkFromUrl(
        "https://tracker.example/dashboard/workspace/ws-1/document/abc123?tab=1#top",
      ),
    ).toEqual({ workspaceId: "ws-1", documentId: "abc123" });
    expect(
      extractDocumentLinkFromUrl(
        "https://tracker.example/dashboard/workspace/ws-1/document/abc123/",
      ),
    ).toEqual({ workspaceId: "ws-1", documentId: "abc123" });
  });

  it.each([
    "https://tracker.example/dashboard/workspace/ws-1/documents",
    "https://tracker.example/dashboard/workspace/ws-1/document/",
    "https://tracker.example/dashboard/workspace/ws-1/document/abc123/history",
    "https://tracker.example/dashboard/workspace/ws-1/project/p1/task/t1",
    "not an address",
  ])("reads nothing from %s", (value) => {
    expect(extractDocumentLinkFromUrl(value)).toBeNull();
  });
});
