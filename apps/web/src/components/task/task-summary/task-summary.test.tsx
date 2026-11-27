import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vite-plus/test";
import { TaskSummary } from "./task-summary";

const m = vi.hoisted(() => ({
  hasAgent: true,
  mutate: vi.fn(),
  data: undefined as unknown,
}));

vi.mock("react-i18next", () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));
vi.mock("@/hooks/queries/agent/use-agent", () => ({
  useHasAgent: () => m.hasAgent,
}));
vi.mock("@/hooks/mutations/agent/use-summarize-task", () => ({
  useSummarizeTask: () => ({
    mutate: m.mutate,
    isPending: false,
    isError: false,
    data: m.data,
  }),
}));
vi.mock("@/components/agent/agent-source-chip", () => ({
  AgentSourceChip: ({ citation }: { citation: { id?: string } }) => (
    <a href={`#comment-${citation.id}`}>{citation.id}</a>
  ),
}));

afterEach(() => {
  cleanup();
  m.mutate.mockReset();
  m.data = undefined;
  m.hasAgent = true;
});

it("asks for a summary on Summarise and shows it with links to the comments", () => {
  render(<TaskSummary workspaceId="w1" taskId="t1" />);
  fireEvent.click(screen.getByRole("button", { name: "tasks:summary.action" }));
  expect(m.mutate).toHaveBeenCalled();

  m.data = {
    currentState: "Waiting for a deploy.",
    blockers: ["Deploy freeze"],
    sources: [
      {
        kind: "comment",
        restricted: false,
        id: "c4",
        title: "Checkout fails",
        taskId: "t1",
        projectId: "p1",
      },
    ],
  };
  render(<TaskSummary workspaceId="w1" taskId="t1" />);
  expect(screen.getByText("Waiting for a deploy.")).toBeInTheDocument();
  expect(screen.getByText("Deploy freeze")).toBeInTheDocument();
  expect(screen.getByRole("link", { name: "c4" })).toHaveAttribute(
    "href",
    "#comment-c4",
  );
});

it("is hidden when the server has no AI", () => {
  m.hasAgent = false;
  const { container } = render(<TaskSummary workspaceId="w1" taskId="t1" />);
  expect(container).toBeEmptyDOMElement();
});
