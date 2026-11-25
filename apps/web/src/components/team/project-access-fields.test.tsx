import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vite-plus/test";
import ProjectAccessFields from "./project-access-fields";

vi.mock("react-i18next", () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

describe("ProjectAccessFields", () => {
  afterEach(cleanup);

  it("does not offer private teams", () => {
    render(
      <ProjectAccessFields
        value={{ projectAccess: "selected", projectIds: [] }}
        onChange={() => {}}
        projects={[
          { id: "a", name: "Alpha" },
          { id: "b", name: "Secret", isPrivate: true },
        ]}
      />,
    );

    expect(screen.getByText("Alpha")).toBeTruthy();
    expect(screen.queryByText("Secret")).toBeNull();
  });
});
