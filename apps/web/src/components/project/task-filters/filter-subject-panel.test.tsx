import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vite-plus/test";
import type { FilterSubject } from "./filter-subject";
import { FilterSubjectPanel } from "./filter-subject-panel";

vi.mock("react-i18next", async (importOriginal) => ({
  ...(await importOriginal<typeof import("react-i18next")>()),
  useTranslation: () => ({ t: (key: string) => key }),
}));

afterEach(cleanup);

const onApply = vi.fn();
const subject: FilterSubject = {
  id: "opened",
  label: "Opened",
  icon: null,
  kind: "core",
  operators: { positive: "is", negative: "is not" },
  options: [{ value: "1d", label: "1 day ago" }],
  selected: [],
  negated: false,
  onToggle: vi.fn(),
  onNegate: vi.fn(),
  onClear: vi.fn(),
  emptyLabel: "",
  custom: {
    label: "Custom date or timeframe...",
    placeholder: "Try: 10 days ago",
    isValid: (text) => text === "10 days ago",
    onApply,
  },
};

it("applies a valid custom timeframe on Enter and ignores an invalid one", () => {
  const onApplied = vi.fn();
  render(<FilterSubjectPanel subject={subject} onApplied={onApplied} />);
  fireEvent.click(screen.getByText("Custom date or timeframe..."));

  const input = screen.getByPlaceholderText("Try: 10 days ago");
  fireEvent.change(input, { target: { value: "nonsense" } });
  fireEvent.keyDown(input, { key: "Enter" });
  expect(onApply).not.toHaveBeenCalled();
  expect(input).toHaveAttribute("aria-invalid", "true");

  fireEvent.change(input, { target: { value: "10 days ago" } });
  fireEvent.keyDown(input, { key: "Enter" });
  expect(onApply).toHaveBeenCalledWith("10 days ago");
  expect(onApplied).toHaveBeenCalled();
});
