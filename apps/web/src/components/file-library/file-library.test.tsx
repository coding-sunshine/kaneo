import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
} from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, describe, expect, it, vi } from "vite-plus/test";
import { FileLibrary } from "./file-library";

const state = vi.hoisted(() => ({
  queries: [] as (string | undefined)[],
}));

const base = {
  mimeType: "application/pdf",
  size: 2048,
  createdAt: "2026-11-01T10:00:00.000Z",
  addedBy: { id: "u1", name: "Sam Example" },
};
const files = [
  {
    ...base,
    id: "a1",
    filename: "spec.pdf",
    url: "http://api.test/api/asset/a1",
    source: {
      kind: "ticket",
      id: "t1",
      name: "Fix checkout",
      projectId: "p1",
      number: 7,
      messageId: null,
      isDirect: false,
    },
  },
  {
    ...base,
    id: "a2",
    filename: "minutes.pdf",
    url: "http://api.test/api/asset/a2",
    addedBy: null,
    source: {
      kind: "chat",
      id: "c1",
      name: "general",
      projectId: null,
      number: null,
      messageId: "m1",
      isDirect: false,
    },
  },
];

vi.mock("react-i18next", async (importOriginal) => ({
  ...(await importOriginal<typeof import("react-i18next")>()),
  useTranslation: () => ({
    t: (key: string, values?: Record<string, unknown>) =>
      values ? `${key} ${JSON.stringify(values)}` : key,
    i18n: { language: "en-US" },
  }),
}));
vi.mock("@tanstack/react-router", () => ({
  Link: ({
    children,
    to,
    params,
  }: {
    children: ReactNode;
    to: string;
    params: Record<string, string>;
  }) => (
    <a
      href={Object.entries(params).reduce(
        (path, [key, value]) => path.replace(`$${key}`, value),
        to,
      )}
    >
      {children}
    </a>
  ),
}));
vi.mock("@/hooks/queries/file-library/use-files", () => ({
  useFiles: (_workspaceId: string, query: string | undefined) => {
    state.queries.push(query);
    return {
      data: query
        ? files.filter((file) => file.filename.includes(query))
        : files,
      isLoading: false,
      isError: false,
    };
  },
}));

describe("FileLibrary", () => {
  afterEach(() => {
    cleanup();
    vi.useRealTimers();
    state.queries = [];
  });

  it("lists each file with who added it and where it came from", () => {
    render(<FileLibrary workspaceId="w1" />);

    const spec = screen.getByRole("link", { name: "spec.pdf" });
    expect(spec.getAttribute("href")).toBe("http://api.test/api/asset/a1");
    expect(screen.getByText("Sam Example")).toBeTruthy();
    expect(
      screen.getByRole("link", { name: /Fix checkout/ }).getAttribute("href"),
    ).toBe("/dashboard/workspace/w1/project/p1/task/t1");
    expect(
      screen.getByRole("link", { name: /general/ }).getAttribute("href"),
    ).toBe("/dashboard/workspace/w1/channels/c1");
    expect(screen.getByText("navigation:files.deletedUser")).toBeTruthy();
  });

  it("asks the API for the typed file name", () => {
    vi.useFakeTimers();
    render(<FileLibrary workspaceId="w1" />);

    fireEvent.change(screen.getByRole("searchbox"), {
      target: { value: "minutes" },
    });
    act(() => {
      vi.advanceTimersByTime(500);
    });

    expect(state.queries.at(-1)).toBe("minutes");
    expect(screen.queryByText("spec.pdf")).toBeNull();
    expect(screen.getByText("minutes.pdf")).toBeTruthy();
  });
});
