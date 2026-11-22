import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vite-plus/test";
import { IssueTemplatesPage } from "./issue-templates-page";

let canEdit = true;
const templates = [
  {
    id: "t1",
    name: "Bug report",
    title: "Bug: ",
    description: "",
    columnId: null,
    priority: "no-priority",
    assigneeId: null,
    labels: [],
  },
];

vi.mock("react-i18next", () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));
vi.mock("@/hooks/queries/workspace/use-active-workspace", () => ({
  default: () => ({ data: { id: "w1" } }),
}));
vi.mock("@/hooks/queries/project/use-get-project", () => ({
  default: () => ({ data: { name: "Alpha" } }),
}));
vi.mock("@/hooks/queries/issue-template/use-get-issue-templates", () => ({
  default: () => ({ data: templates }),
}));
vi.mock("@/hooks/mutations/issue-template/use-delete-issue-template", () => ({
  default: () => ({ mutateAsync: vi.fn(), isPending: false }),
}));
vi.mock("@/hooks/use-workspace-permission", () => ({
  useWorkspacePermission: () => ({ canUpdateProjects: () => canEdit }),
}));
vi.mock("@/components/project/issue-templates/issue-template-dialog", () => ({
  IssueTemplateDialog: () => null,
}));

afterEach(cleanup);

describe("IssueTemplatesPage", () => {
  it("lists templates and offers creation to editors", () => {
    canEdit = true;
    render(<IssueTemplatesPage projectId="p1" />);
    expect(screen.getByText("Bug report")).toBeTruthy();
    expect(
      screen.getAllByText("settings:issueTemplates.newTemplate").length,
    ).toBeGreaterThan(0);
    fireEvent.click(
      screen.getAllByText("settings:issueTemplates.newTemplate")[0],
    );
  });

  it("hides creation from users who cannot update the team", () => {
    canEdit = false;
    render(<IssueTemplatesPage projectId="p1" />);
    expect(screen.getByText("Bug report")).toBeTruthy();
    expect(
      screen.queryByText("settings:issueTemplates.newTemplate"),
    ).toBeNull();
  });
});
