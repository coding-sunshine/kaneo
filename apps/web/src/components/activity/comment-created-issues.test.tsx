import { cleanup, render, screen } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, describe, expect, it, vi } from "vite-plus/test";
import CommentCreatedIssues, {
  type CreatedIssue,
} from "./comment-created-issues";

afterEach(cleanup);

vi.mock("@tanstack/react-router", () => ({
  Link: ({
    children,
    params,
  }: {
    children: ReactNode;
    params: { taskId: string };
  }) => <a href={`/task/${params.taskId}`}>{children}</a>,
}));

vi.mock("@/hooks/queries/workspace/use-active-workspace", () => ({
  default: () => ({ data: { id: "w1" } }),
}));

vi.mock("react-i18next", () => ({
  useTranslation: () => ({ t: (key: string) => key }),
  Trans: ({
    i18nKey,
    values,
  }: {
    i18nKey: string;
    values: { name: string; count: number };
  }) => `${values.name} ${i18nKey} ${values.count}`,
}));

const issue = (over: Partial<CreatedIssue>): CreatedIssue => ({
  id: "t1",
  projectId: "p1",
  projectSlug: "ENG",
  number: 7,
  title: "Follow-up",
  status: "to-do",
  statusIcon: null,
  isCompleted: false,
  isSubIssue: false,
  creatorId: "u1",
  creatorName: "Ada",
  ...over,
});

describe("CommentCreatedIssues", () => {
  it("shows one issue inline with its creator and identifier", () => {
    render(<CommentCreatedIssues issues={[issue({ isSubIssue: true })]} />);

    expect(
      screen.getByText("Ada activity:comment.createdSubIssue 1"),
    ).toBeTruthy();
    const link = screen.getByRole("link");
    expect(link.getAttribute("href")).toBe("/task/t1");
    expect(link.textContent).toContain("ENG-7");
    expect(link.textContent).toContain("Follow-up");
  });

  it("groups several issues per creator with one row each", () => {
    render(
      <CommentCreatedIssues
        issues={[
          issue({ id: "t1" }),
          issue({ id: "t2", number: 8, isSubIssue: true }),
          issue({ id: "t3", creatorId: null, creatorName: null }),
        ]}
      />,
    );

    expect(
      screen.getByText("Ada activity:comment.createdIssues 2"),
    ).toBeTruthy();
    expect(
      screen.getByText("common:people.someone activity:comment.createdIssue 1"),
    ).toBeTruthy();
    expect(
      screen.getAllByRole("link").map((a) => a.getAttribute("href")),
    ).toEqual(["/task/t1", "/task/t2", "/task/t3"]);
  });
});
