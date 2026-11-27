import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vite-plus/test";
import { TemplatePickerDialog } from "./template-picker-dialog";

const mocks = vi.hoisted(() => ({
  createDocument: vi.fn(),
  getDocumentTemplates: vi.fn(),
  deleteDocumentTemplate: vi.fn(),
  navigate: vi.fn(),
}));

vi.mock("react-i18next", () => ({
  useTranslation: () => ({ t: (key: string) => key }),
  initReactI18next: { type: "3rdParty", init: () => {} },
}));
vi.mock("@tanstack/react-router", () => ({
  useNavigate: () => mocks.navigate,
}));
vi.mock("@/components/providers/auth-provider/hooks/use-auth", () => ({
  default: () => ({ user: { id: "me" } }),
}));
vi.mock("@/fetchers/document/documents", () => ({
  createDocument: mocks.createDocument,
}));
vi.mock("@/fetchers/document/templates", () => ({
  getDocumentTemplates: mocks.getDocumentTemplates,
  deleteDocumentTemplate: mocks.deleteDocumentTemplate,
}));
vi.mock("@/lib/toast", () => ({
  toast: { success: vi.fn(), error: vi.fn() },
}));

const KEY = "navigation:documents.templates";

const show = () =>
  render(
    <QueryClientProvider
      client={
        new QueryClient({ defaultOptions: { queries: { retry: false } } })
      }
    >
      <TemplatePickerDialog workspaceId="ws-1" onClose={vi.fn()} />
    </QueryClientProvider>,
  );

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe("TemplatePickerDialog", () => {
  it("opens a postmortem with the template headings", async () => {
    mocks.getDocumentTemplates.mockResolvedValue([]);
    mocks.createDocument.mockResolvedValue({ id: "doc-9" });
    show();
    fireEvent.click(
      screen.getByRole("button", { name: `${KEY}.builtIn.postmortem.name` }),
    );
    await waitFor(() => expect(mocks.createDocument).toHaveBeenCalled());
    const [input] = mocks.createDocument.mock.calls[0] ?? [];
    expect(input.workspaceId).toBe("ws-1");
    expect(input.title).toBe(`${KEY}.builtIn.postmortem.name`);
    for (const heading of ["summary", "impact", "timeline", "rootCause"]) {
      expect(input.content).toContain(`<h2>${KEY}.headings.${heading}</h2>`);
    }
    await waitFor(() =>
      expect(mocks.navigate).toHaveBeenCalledWith(
        expect.objectContaining({
          params: { workspaceId: "ws-1", documentId: "doc-9" },
        }),
      ),
    );
  });

  it("lists the four built-in templates", () => {
    mocks.getDocumentTemplates.mockResolvedValue([]);
    show();
    for (const id of ["meetingNotes", "runbook", "postmortem", "rfc"]) {
      expect(
        screen.getByRole("button", { name: `${KEY}.builtIn.${id}.name` }),
      ).toBeTruthy();
    }
  });

  it("starts a document from a saved template with its own text", async () => {
    mocks.getDocumentTemplates.mockResolvedValue([
      {
        id: "t1",
        name: "Retro",
        title: "Sprint retro",
        content: "<h2>Went well</h2>",
        creatorId: "someone-else",
      },
    ]);
    mocks.createDocument.mockResolvedValue({ id: "doc-2" });
    show();
    fireEvent.click(await screen.findByRole("button", { name: "Retro" }));
    await waitFor(() =>
      expect(mocks.createDocument).toHaveBeenCalledWith({
        workspaceId: "ws-1",
        title: "Sprint retro",
        content: "<h2>Went well</h2>",
      }),
    );
    // Only its creator gets a delete button.
    expect(screen.queryByRole("button", { name: `${KEY}.delete` })).toBeNull();
  });

  it("lets the creator delete their own template", async () => {
    mocks.getDocumentTemplates.mockResolvedValue([
      { id: "t2", name: "Mine", title: "", content: "", creatorId: "me" },
    ]);
    mocks.deleteDocumentTemplate.mockResolvedValue({ id: "t2" });
    show();
    fireEvent.click(
      await screen.findByRole("button", { name: `${KEY}.delete` }),
    );
    await waitFor(() =>
      expect(mocks.deleteDocumentTemplate).toHaveBeenCalledWith("ws-1", "t2"),
    );
  });
});
