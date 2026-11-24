import { cleanup, render, screen } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, describe, expect, it, vi } from "vite-plus/test";
import { formatDateMedium } from "@/lib/format";
import {
  type BannerDocument,
  DocumentStatusBanner,
} from "./document-status-banner";

// Prints what a key was given, so a test can see a date or a reason.
vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (key: string, values?: Record<string, unknown>) =>
      values ? `${key} ${JSON.stringify(values)}` : key,
  }),
  initReactI18next: { type: "3rdParty", init: () => {} },
}));
vi.mock("@tanstack/react-router", () => ({
  Link: ({
    params,
    children,
  }: {
    params: Record<string, string>;
    children: ReactNode;
  }) => <a href={`/${params.documentId ?? params.topicId}`}>{children}</a>,
}));

const APPROVED_AT = "2026-11-03T09:00:00.000Z";
const CONFIRMED_AT = "2026-11-20T09:00:00.000Z";

const show = (
  labels: Partial<BannerDocument> = {},
  rest: { currentDocumentId?: string | null; actions?: ReactNode } = {},
) => {
  render(
    <DocumentStatusBanner
      document={{
        workspaceId: "ws-1",
        id: "doc-1",
        kind: "unsorted",
        status: "draft",
        sourceClient: null,
        topicId: null,
        topicName: null,
        contentHash: "text",
        approvedHash: null,
        approvedAt: null,
        confirmedAt: null,
        statusReason: null,
        ...labels,
      }}
      {...rest}
    />,
  );
  return screen.getByRole("status").textContent ?? "";
};
const banner = (name: string) => [
  `navigation:documents.banner.${name}.lead`,
  `navigation:documents.banner.${name}.detail`,
];
const hrefs = () =>
  screen.queryAllByRole("link").map((link) => link.getAttribute("href"));
const approved = {
  status: "current",
  topicId: "topic-1",
  topicName: "Launch plan",
  approvedHash: "text",
  approvedAt: APPROVED_AT,
} as const;

describe("DocumentStatusBanner", () => {
  afterEach(cleanup);

  it("says a new document is a draft", () => {
    const text = show();
    for (const key of banner("draft")) expect(text).toContain(key);
    expect(text).not.toContain("savedFrom");
    expect(hrefs()).toEqual([]);
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

  it("says when a current document was approved and links its topic", () => {
    const text = show(approved, { currentDocumentId: "doc-1" });
    expect(text).toContain("navigation:documents.banner.current.lead");
    expect(text).toContain("navigation:documents.banner.current.approved");
    expect(text).toContain(formatDateMedium(APPROVED_AT));
    expect(text).toContain('"age":');
    expect(text).not.toContain("banner.current.detail");
    expect(text).not.toContain("banner.current.confirmed");
    expect(text).toContain("Launch plan");
    // The topic, and no link from the current document to itself.
    expect(hrefs()).toEqual(["/topic-1"]);
  });

  it("says when the decider last confirmed it", () => {
    const text = show({ ...approved, confirmedAt: CONFIRMED_AT });
    expect(text).toContain("navigation:documents.banner.current.confirmed");
    expect(text).toContain(formatDateMedium(CONFIRMED_AT));
  });

  it("says a current document was edited after its approval", () => {
    const text = show({
      ...approved,
      contentHash: "new text",
      confirmedAt: CONFIRMED_AT,
    });
    for (const key of banner("edited")) expect(text).toContain(key);
    expect(text).not.toContain("banner.current");
  });

  it("sends the reader of a replaced document to the current one", () => {
    const text = show(
      {
        status: "superseded",
        topicId: "topic-1",
        topicName: "Launch plan",
        statusReason: "Replaces the current document: 4 sentences changed",
      },
      { currentDocumentId: "doc-2" },
    );
    for (const key of banner("superseded")) expect(text).toContain(key);
    expect(text).toContain("4 sentences changed");
    expect(hrefs()).toEqual(["/topic-1", "/doc-2"]);
  });

  it("tells a proposal's reader where the current document is", () => {
    show(
      { status: "in_review", topicId: "topic-1", topicName: "Launch plan" },
      { currentDocumentId: "doc-2" },
    );
    expect(hrefs()).toEqual(["/topic-1", "/doc-2"]);
  });

  it("links nothing for a reader who cannot open the topic", () => {
    const text = show({
      status: "superseded",
      statusReason: "Replaced",
    });
    for (const key of banner("superseded")) expect(text).toContain(key);
    expect(hrefs()).toEqual([]);
  });

  it("shows what the reader may do next beside the status", () => {
    show({}, { actions: <button type="button">File it</button> });
    expect(screen.getByRole("button", { name: "File it" })).toBeTruthy();
    expect(screen.getByRole("status").textContent).not.toContain("File it");
  });
});
