import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vite-plus/test";
// Loads the real English copy, so the assertions read like the chip does.
import "@/lib/i18n";
import type { FilterSubject } from "@/components/project/task-filters/filter-subject";
import { ReviewsAdvancedFilterChip } from "./reviews-advanced-filter-chip";

afterEach(cleanup);

const subject = (id: string, selected: string[]): FilterSubject => ({
  id,
  label: id,
  icon: null,
  kind: "core",
  operators: { positive: "is", negative: "is not" },
  options: [{ value: "true", label: "Yes" }],
  selected,
  negated: false,
  onToggle: vi.fn(),
  onNegate: vi.fn(),
  onClear: vi.fn(),
  emptyLabel: "None",
});

const renderChip = (subjects: FilterSubject[], open = false) => {
  const props = {
    onOpenChange: vi.fn(),
    onOperatorChange: vi.fn(),
    onRemove: vi.fn(),
  };
  render(
    <ReviewsAdvancedFilterChip
      operator="or"
      subjects={subjects}
      open={open}
      {...props}
    />,
  );
  return props;
};

it("is named after the filter while empty and removes itself", () => {
  const { onRemove } = renderChip([subject("Size", [])]);
  expect(screen.getByRole("button", { name: "Advanced filter" })).toBeVisible();
  fireEvent.click(
    screen.getByRole("button", { name: "Remove advanced filter" }),
  );
  expect(onRemove).toHaveBeenCalledOnce();
});

it("counts its conditions and flips the operator that joins them", () => {
  const { onOperatorChange } = renderChip(
    [
      subject("Size", ["true"]),
      subject("Checks", ["true"]),
      subject("Team", []),
    ],
    true,
  );
  expect(
    screen.getByRole("button", { name: "Advanced filter: 2 conditions" }),
  ).toBeVisible();
  expect(screen.getByText("Size")).toBeInTheDocument();
  expect(screen.getByText("Checks")).toBeInTheDocument();
  expect(screen.queryByText("Team")).not.toBeInTheDocument();

  // One before the second condition, one before "+ Filter".
  const toggles = screen.getAllByRole("button", {
    name: "Toggle filter operator, currently or",
  });
  expect(toggles).toHaveLength(2);
  fireEvent.click(toggles[0]);
  expect(onOperatorChange).toHaveBeenCalledWith("and");
});
