import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, render, screen, within } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, describe, expect, it, vi } from "vite-plus/test";
import type {
  DocumentDetail,
  DocumentSummary,
} from "@/fetchers/document/documents";
import type { Topic } from "@/fetchers/topic/topics";
import { formatDateMedium } from "@/lib/format";
import { TopicPage } from "./topic-page";

const mocks = vi.hoisted(() => ({
  getTopic: vi.fn(),
  getDocument: vi.fn(),
  getDocuments: vi.fn(),
}));

// Prints what a key was given, so a test can see a name or a date.
vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (key: string, values?: Record<string, unknown>) =>
      values ? `${key} ${JSON.stringify(values)}` : key,
  }),
  initReactI18next: { type: "3rdParty", init: () => {} },
}));
vi.mock("@/fetchers/topic/topics", () => ({ getTopic: mocks.getTopic }));
vi.mock("@/fetchers/document/documents", () => ({
  getDocument: mocks.getDocument,
  getDocuments: mocks.getDocuments,
}));
vi.mock("@tanstack/react-router", () => ({
  Link: ({
    params,
    children,
  }: {
    params: Record<string, string>;
    children: ReactNode;
  }) => (
    <a href={`/${params.documentId ?? params.topicId ?? "documents"}`}>
      {children}
    </a>
  ),
}));
vi.mock("@/components/common/workspace-layout", () => ({
  default: ({ children }: { children: ReactNode }) => <main>{children}</main>,
}));
vi.mock("@/components/page-title", () => ({ default: () => null }));

const APPROVED_AT = "2026-11-03T09:00:00.000Z";

const topic = {
  id: "topic-1",
  workspaceId: "ws-1",
  name: "Launch plan",
  scope: "team",
  projectId: "team-1",
  workProjectId: null,
  parentName: "Growth",
  deciderId: "user-1",
  deciderName: "Decider Person",
  deciderImage: null,
  backupDeciderId: "user-2",
  backupDeciderName: "Backup Person",
  backupDeciderImage: null,
  currentDocumentId: "doc-current",
  canDecide: false,
  createdAt: APPROVED_AT,
  updatedAt: APPROVED_AT,
} as Topic;

const row = (id: string, status: DocumentSummary["status"]) =>
  ({
    id,
    title: `Title of ${id}`,
    status,
    kind: "unsorted",
    parentName: "Growth",
    creatorName: "Author Person",
    creatorImage: null,
    updatedAt: APPROVED_AT,
  }) as DocumentSummary;

const current = {
  ...row("doc-current", "current"),
  contentHash: "same",
  approvedHash: "same",
  approvedAt: APPROVED_AT,
  approvedByName: "Decider Person",
  statusReason: "Starting point",
} as unknown as DocumentDetail;

const show = () => {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  render(
    <QueryClientProvider client={client}>
      <TopicPage workspaceId="ws-1" topicId="topic-1" />
    </QueryClientProvider>,
  );
};

const section = async (name: string) =>
  within(await screen.findByRole("region", { name }));

describe("TopicPage", () => {
  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
  });

  it("shows the current document, then the proposals, then what was replaced", async () => {
    mocks.getTopic.mockResolvedValue(topic);
    mocks.getDocument.mockResolvedValue(current);
    mocks.getDocuments.mockResolvedValue([
      row("doc-old", "superseded"),
      row("doc-current", "current"),
      row("doc-b", "in_review"),
      row("doc-a", "in_review"),
    ]);
    show();

    expect(
      await screen.findByRole("heading", { name: "Launch plan" }),
    ).toBeTruthy();
    expect(mocks.getTopic).toHaveBeenCalledWith("ws-1", "topic-1");
    expect(mocks.getDocuments).toHaveBeenCalledWith("ws-1", {
      topicId: "topic-1",
    });
    expect(mocks.getDocument).toHaveBeenCalledWith("ws-1", "doc-current");

    const now = await section("navigation:documents.topics.current");
    expect(
      (
        await now.findByRole("link", { name: /Title of doc-current/ })
      ).getAttribute("href"),
    ).toBe("/doc-current");
    const approval = now.getByText(/topics\.approved /).textContent ?? "";
    expect(approval).toContain("Decider Person");
    expect(approval).toContain(formatDateMedium(APPROVED_AT));
    expect(now.getByText(/Starting point/)).toBeTruthy();
    expect(now.queryByText(/Title of doc-(a|b|old)/)).toBeNull();
    expect(now.queryByText(/banner\.edited/)).toBeNull();

    const proposals = await section("navigation:documents.topics.proposals");
    expect(
      proposals.getAllByRole("link").map((link) => link.getAttribute("href")),
    ).toEqual(["/doc-b", "/doc-a"]);

    const replaced = await section("navigation:documents.topics.replaced");
    expect(
      replaced.getAllByRole("link").map((link) => link.getAttribute("href")),
    ).toEqual(["/doc-old"]);
  });

  it("names the decider, the backup and the place", async () => {
    mocks.getTopic.mockResolvedValue(topic);
    mocks.getDocument.mockResolvedValue(current);
    mocks.getDocuments.mockResolvedValue([]);
    show();

    const text = (await screen.findByRole("main")).textContent ?? "";
    await screen.findByText(/topics\.decider /);
    expect(screen.getByText(/topics\.decider /).textContent).toContain(
      "Decider Person",
    );
    expect(screen.getByText(/topics\.backup /).textContent).toContain(
      "Backup Person",
    );
    expect(screen.getByText("Growth")).toBeTruthy();
    expect(text).not.toContain("topics.notFound");
  });

  it("says when the current document was edited after its approval", async () => {
    mocks.getTopic.mockResolvedValue(topic);
    mocks.getDocument.mockResolvedValue({ ...current, contentHash: "other" });
    mocks.getDocuments.mockResolvedValue([row("doc-current", "current")]);
    show();

    const now = await section("navigation:documents.topics.current");
    expect(
      await now.findByText("navigation:documents.banner.edited.lead"),
    ).toBeTruthy();
  });

  it("says so when nothing is current and nothing is proposed", async () => {
    mocks.getTopic.mockResolvedValue({ ...topic, currentDocumentId: null });
    mocks.getDocuments.mockResolvedValue([]);
    show();

    const now = await section("navigation:documents.topics.current");
    expect(now.getByText("navigation:documents.topics.noCurrent")).toBeTruthy();
    expect(mocks.getDocument).not.toHaveBeenCalled();
    const proposals = await section("navigation:documents.topics.proposals");
    expect(
      proposals.getByText("navigation:documents.topics.noProposals"),
    ).toBeTruthy();
    // Nothing was replaced, so the section is not shown at all.
    expect(
      screen.queryByRole("region", {
        name: "navigation:documents.topics.replaced",
      }),
    ).toBeNull();
  });

  it("says a hidden or unknown topic was not found", async () => {
    mocks.getTopic.mockRejectedValue(new Error("Topic not found"));
    mocks.getDocuments.mockResolvedValue([]);
    show();

    expect(
      await screen.findByText("navigation:documents.topics.notFound"),
    ).toBeTruthy();
    expect(screen.queryByRole("region")).toBeNull();
  });
});
