import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vite-plus/test";
import EmojiPicker from "./emoji-picker";

afterEach(cleanup);

vi.mock("react-i18next", () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));
vi.mock("@/components/providers/auth-provider/hooks/use-auth", () => ({
  useAuth: () => ({ user: { id: "u1" } }),
}));
vi.mock("@/hooks/queries/emoji/use-workspace-emoji", () => ({
  default: () => ({
    data: [{ id: "1", name: "party_parrot", url: "/parrot.png" }],
  }),
}));

describe("EmojiPicker custom section", () => {
  it("lists workspace emoji last and finds them by name", () => {
    const onSelect = vi.fn();
    render(<EmojiPicker onSelect={onSelect} onAddEmoji={vi.fn()} />);
    const headings = screen
      .getAllByText(/^activity:reactions\.(groups\.\w+|frequentlyUsed)$/)
      .map((node) => node.textContent);
    expect(headings.at(-1)).toBe("activity:reactions.groups.custom");

    fireEvent.change(screen.getByLabelText("activity:reactions.search"), {
      target: { value: "parrot" },
    });
    fireEvent.click(screen.getByRole("button", { name: "party_parrot" }));
    expect(onSelect).toHaveBeenCalledWith(":party_parrot:");
  });

  it("shows the Add emoji footer only when allowed", () => {
    const { rerender } = render(<EmojiPicker onSelect={vi.fn()} />);
    expect(screen.queryByText("activity:reactions.addEmoji")).toBeNull();
    rerender(<EmojiPicker onSelect={vi.fn()} onAddEmoji={vi.fn()} />);
    expect(screen.getByText("activity:reactions.addEmoji")).toBeVisible();
  });
});
