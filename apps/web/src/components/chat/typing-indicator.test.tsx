import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vite-plus/test";
import { TypingIndicator } from "./typing-indicator";

vi.mock(
  "@/hooks/queries/workspace-users/use-get-active-workspace-users",
  () => ({
    useGetActiveWorkspaceUsers: () => ({
      data: {
        members: [
          { userId: "a", user: { name: "Member A" } },
          { userId: "b", user: { name: "Member B" } },
        ],
      },
    }),
  }),
);
vi.mock("react-i18next", () => ({
  initReactI18next: { type: "3rdParty", init: vi.fn() },
  useTranslation: () => ({
    t: (key: string, options?: Record<string, string>) =>
      options ? `${key} ${JSON.stringify(options)}` : key,
  }),
}));

afterEach(cleanup);

const status = () => screen.getByRole("status").textContent;

describe("typing indicator", () => {
  it("says nothing while nobody types", () => {
    render(<TypingIndicator workspaceId="ws-1" userIds={[]} />);
    expect(status()).toBe("");
  });

  it("names one person typing", () => {
    render(<TypingIndicator workspaceId="ws-1" userIds={["a"]} />);
    expect(status()).toBe('navigation:chat.typingOne {"name":"Member A"}');
  });

  it("names two people typing", () => {
    render(<TypingIndicator workspaceId="ws-1" userIds={["a", "b"]} />);
    expect(status()).toBe(
      'navigation:chat.typingTwo {"first":"Member A","second":"Member B"}',
    );
  });

  it("counts three or more without naming them", () => {
    render(<TypingIndicator workspaceId="ws-1" userIds={["a", "b", "c"]} />);
    expect(status()).toBe("navigation:chat.typingMany");
  });
});
