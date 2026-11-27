import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import type { ReactElement, ReactNode } from "react";
import { cloneElement, isValidElement } from "react";
import { afterEach, describe, expect, it, vi } from "vite-plus/test";
import CommentCard from "./comment-card";

afterEach(() => {
  cleanup();
  auth.user = null;
});

vi.mock("./emoji-picker/add-emoji-dialog", () => ({ default: () => null }));
vi.mock("@/hooks/queries/task/use-get-task", () => ({
  default: () => ({ data: undefined }),
}));

vi.mock("@/hooks/use-workspace-permission", () => ({
  useWorkspacePermission: () => ({ canCreateTasks: () => false }),
}));

vi.mock("@/components/activity/comment-editor", () => ({
  default: ({ value }: { value: string }) => <div>{value}</div>,
}));

const auth = vi.hoisted(() => ({ user: null as { id: string } | null }));
vi.mock("@/components/providers/auth-provider/hooks/use-auth", () => ({
  useAuth: () => auth,
}));

vi.mock("@/hooks/mutations/comment/use-update-comment", () => ({
  default: () => ({
    mutateAsync: vi.fn(),
    isPending: false,
  }),
}));

vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (key: string, values?: Record<string, string>) =>
      `${key}${values ? ` ${Object.values(values).join(" ")}` : ""}`,
  }),
}));

vi.mock("@/lib/format", () => ({
  formatRelativeTime: () => "2 hours ago",
  formatDateTime: () => "Apr 5, 2026, 11:38 AM",
}));

vi.mock("@/components/ui/tooltip", async () => {
  const React = await import("react");

  function Tooltip({ children }: { children: ReactNode }) {
    const [open, setOpen] = React.useState(false);
    return (
      <div data-testid="tooltip-root">
        {React.Children.map(children, (child) =>
          isValidElement(child)
            ? cloneElement(
                child as ReactElement<{
                  open?: boolean;
                  setOpen?: (open: boolean) => void;
                }>,
                {
                  open,
                  setOpen,
                },
              )
            : child,
        )}
      </div>
    );
  }

  function TooltipTrigger({
    children,
    setOpen,
  }: {
    children: ReactElement;
    setOpen?: (open: boolean) => void;
  }) {
    return cloneElement(children as ReactElement<Record<string, unknown>>, {
      onMouseEnter: () => setOpen?.(true),
      onMouseLeave: () => setOpen?.(false),
      onFocus: () => setOpen?.(true),
      onBlur: () => setOpen?.(false),
    });
  }

  function TooltipContent({
    children,
    open,
  }: {
    children: ReactNode;
    open?: boolean;
  }) {
    return open ? <div role="tooltip">{children}</div> : null;
  }

  function TooltipProvider({ children }: { children: ReactNode }) {
    return <>{children}</>;
  }

  return {
    Tooltip,
    TooltipContent,
    TooltipProvider,
    TooltipTrigger,
  };
});

function renderCommentCard(
  externalSource?: string,
  importedBy?: string,
  ownerId = "user-1",
  email = "tin@example.com",
) {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  });

  return render(
    <QueryClientProvider client={queryClient}>
      <CommentCard
        externalSource={externalSource}
        importedBy={importedBy}
        ownerId={ownerId}
        commentId="comment-1"
        taskId="task-1"
        content="Test comment"
        createdAt="2026-04-05T09:38:50.000Z"
        user={{
          id: "user-1",
          name: "Tin",
          email,
          image: null,
        }}
      />
    </QueryClientProvider>,
  );
}

describe("CommentCard", () => {
  it.each(["planka", "trello", "jira", "github"])(
    "visibly identifies %s authors as imported without hovering",
    (source) => {
      renderCommentCard(source, "Actual Importer");
      expect(screen.getByText(/activity:comment.importedFrom/)).toBeVisible();
      expect(
        screen.getByText(/activity:comment.importedBy Actual Importer/),
      ).toBeVisible();
    },
  );

  it("names an author whose email a guest cannot see", () => {
    renderCommentCard(undefined, undefined, "user-1", "");
    expect(screen.getAllByText("Tin").length).toBeGreaterThan(0);
    expect(screen.queryByText(/@/)).not.toBeInTheDocument();
  });

  it("does not label ordinary comments as imports", () => {
    renderCommentCard();
    expect(
      screen.queryByText(/activity:comment.importedFrom/),
    ).not.toBeInTheDocument();
  });

  it("shows full date+short time in tooltip on hover/focus", async () => {
    renderCommentCard();

    const trigger = screen.getByRole("button", {
      name: "Apr 5, 2026, 11:38 AM",
    });

    fireEvent.mouseEnter(trigger);
    expect(await screen.findByText("Apr 5, 2026, 11:38 AM")).toBeVisible();

    fireEvent.mouseLeave(trigger);
    expect(screen.queryByText("Apr 5, 2026, 11:38 AM")).not.toBeInTheDocument();

    fireEvent.focus(trigger);
    expect(await screen.findByText("Apr 5, 2026, 11:38 AM")).toBeVisible();
  });

  it.each([
    ["the owner of an imported comment", "user-1", true],
    ["someone else", "user-2", false],
  ])("lets %s edit it", async (_, viewer, canEdit) => {
    auth.user = { id: viewer };
    renderCommentCard("linear", undefined);
    fireEvent.contextMenu(screen.getByText("Test comment"));
    await screen.findByRole("menuitem", { name: "activity:comment.copyLink" });
    expect(
      screen.queryByRole("menuitem", { name: "activity:comment.editMenu" }) !==
        null,
    ).toBe(canEdit);
  });

  it("right-click opens the comment menu", async () => {
    renderCommentCard();

    expect(screen.queryByRole("menuitem")).not.toBeInTheDocument();
    fireEvent.contextMenu(screen.getByText("Test comment"));

    expect(
      await screen.findByRole("menuitem", {
        name: "activity:comment.copyLink",
      }),
    ).toBeVisible();
    expect(
      screen.getByRole("menuitem", { name: "activity:comment.resolveThread" }),
    ).toBeVisible();
  });
});
