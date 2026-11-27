import {
  cleanup,
  fireEvent,
  render,
  screen,
  within,
} from "@testing-library/react";
import { useState } from "react";
import { afterEach, expect, it, vi } from "vite-plus/test";
// Loads the real English copy, so the assertions read like the chip does.
import "@/lib/i18n";
import type { FilterSubject } from "@/components/project/task-filters/filter-subject";
import type { ReviewsAdvancedFilter } from "@/lib/reviews-advanced";
import type { ReviewFilter, ReviewFilterId } from "@/lib/reviews-filters";
import { ReviewsAdvancedFilterChip } from "./reviews-advanced-filter-chip";

afterEach(cleanup);

const OPTIONS: Partial<
  Record<ReviewFilterId, { value: string; label: string }[]>
> = {
  size: [
    { value: "u10", label: "< 10" },
    { value: "u50", label: "< 50" },
  ],
  checks: [
    { value: "success", label: "Passed" },
    { value: "failure", label: "Failed" },
  ],
  labels: [
    { value: "bug", label: "bug" },
    { value: "urgent", label: "urgent" },
  ],
  mergeStatus: [
    { value: "blocked", label: "Blocked" },
    { value: "ready", label: "Ready" },
  ],
  hasConflicts: [{ value: "true", label: "Yes" }],
};

const LABELS: Partial<Record<ReviewFilterId, string>> = {
  size: "Size",
  checks: "Checks",
  labels: "Labels",
  mergeStatus: "Merge status",
  hasConflicts: "Has conflicts",
};

const SUBJECT_IDS: ReviewFilterId[] = [
  "size",
  "checks",
  "labels",
  "mergeStatus",
  "hasConflicts",
];

const bindSubject = (
  id: ReviewFilterId,
  value: ReviewFilter,
  onChange: (next: ReviewFilter | null) => void,
): FilterSubject => ({
  id,
  label: LABELS[id] ?? id,
  icon: null,
  kind: "core",
  operators: { positive: "is", negative: "is not" },
  options: OPTIONS[id] ?? [{ value: "true", label: "Yes" }],
  selected: value.values,
  negated: value.negated,
  onToggle: (entry) => {
    const values = value.values.includes(entry)
      ? value.values.filter((v) => v !== entry)
      : [...value.values, entry];
    onChange(values.length > 0 ? { ...value, values } : null);
  },
  onNegate: (negated) => onChange({ ...value, negated }),
  onClear: () => onChange(null),
  emptyLabel: "None",
});

function ControlledChip({
  initial,
  open = true,
  onRemove = vi.fn(),
}: {
  initial: ReviewsAdvancedFilter;
  open?: boolean;
  onRemove?: () => void;
}) {
  const [filter, setFilter] = useState(initial);
  return (
    <ReviewsAdvancedFilterChip
      filter={filter}
      bindSubject={bindSubject}
      subjectIds={SUBJECT_IDS}
      open={open}
      onOpenChange={vi.fn()}
      onChange={setFilter}
      onRemove={onRemove}
    />
  );
}

it("is named after the filter while empty and removes itself", () => {
  const onRemove = vi.fn();
  render(
    <ControlledChip
      initial={{ operator: "or", conditions: [] }}
      open={false}
      onRemove={onRemove}
    />,
  );
  expect(screen.getByRole("button", { name: "Advanced filter" })).toBeVisible();
  fireEvent.click(
    screen.getByRole("button", { name: "Remove advanced filter" }),
  );
  expect(onRemove).toHaveBeenCalledOnce();
});

it("counts its conditions and flips the operator that joins them", () => {
  render(
    <ControlledChip
      initial={{
        operator: "or",
        conditions: [
          {
            kind: "condition",
            id: "c1",
            subject: "size",
            values: ["u10"],
            negated: false,
          },
          {
            kind: "condition",
            id: "c2",
            subject: "checks",
            values: ["success"],
            negated: false,
          },
        ],
      }}
    />,
  );
  expect(
    screen.getByRole("button", { name: "Advanced filter: 2 conditions" }),
  ).toBeVisible();
  expect(screen.getByText("Size")).toBeInTheDocument();
  expect(screen.getByText("Checks")).toBeInTheDocument();

  // One before the second condition, one before "+ Filter".
  const toggles = screen.getAllByRole("button", {
    name: "Toggle filter operator, currently or",
  });
  expect(toggles).toHaveLength(2);
  fireEvent.click(toggles[0]);
  expect(
    screen.getAllByRole("button", {
      name: "Toggle filter operator, currently and",
    }),
  ).toHaveLength(2);
});

it("allows two conditions on the same subject and removes only the targeted one", async () => {
  render(
    <ControlledChip
      initial={{
        operator: "and",
        conditions: [
          {
            kind: "condition",
            id: "c1",
            subject: "labels",
            values: ["bug"],
            negated: false,
          },
        ],
      }}
    />,
  );

  // Add a second Labels condition via "+ Filter".
  const dialog = screen.getByRole("dialog", { name: "Advanced filter" });
  fireEvent.click(within(dialog).getByRole("button", { name: "Filter" }));
  fireEvent.click((await screen.findAllByText("Labels")).at(-1) as HTMLElement);
  fireEvent.click(await screen.findByText("urgent"));

  expect(
    screen.getByRole("button", { name: "Advanced filter: 2 conditions" }),
  ).toBeVisible();
  expect(within(dialog).getByText("bug")).toBeInTheDocument();
  expect(within(dialog).getByText("urgent")).toBeInTheDocument();

  // Removing the first Labels chip leaves the second intact.
  const removeButtons = within(dialog).getAllByRole("button", {
    name: "Remove Labels filter",
  });
  expect(removeButtons).toHaveLength(2);
  fireEvent.click(removeButtons[0]);
  expect(
    screen.getByRole("button", { name: "Advanced filter: 1 condition" }),
  ).toBeVisible();
  expect(within(dialog).queryByText("bug")).not.toBeInTheDocument();
  expect(within(dialog).getByText("urgent")).toBeInTheDocument();
});

it("renders a nested filter group with its own independent and/or operator", async () => {
  render(
    <ControlledChip
      initial={{
        operator: "and",
        conditions: [
          {
            kind: "condition",
            id: "c1",
            subject: "size",
            values: ["u10"],
            negated: false,
          },
          {
            kind: "group",
            id: "g1",
            operator: "or",
            conditions: [
              {
                kind: "condition",
                id: "c2",
                subject: "mergeStatus",
                values: ["blocked"],
                negated: false,
              },
              {
                kind: "condition",
                id: "c3",
                subject: "hasConflicts",
                values: ["true"],
                negated: false,
              },
            ],
          },
        ],
      }}
    />,
  );

  expect(
    screen.getByRole("button", { name: "Advanced filter: 3 conditions" }),
  ).toBeVisible();

  const nestedGroup = screen.getByRole("group", { name: "Filter group" });
  expect(within(nestedGroup).getByText("Merge status")).toBeInTheDocument();
  expect(within(nestedGroup).getByText("Has conflicts")).toBeInTheDocument();

  // Root uses "and"; nested group uses "or". Flipping nested group leaves root on "and".
  const nestedToggles = within(nestedGroup).getAllByRole("button", {
    name: "Toggle filter operator, currently or",
  });
  expect(nestedToggles).toHaveLength(2);
  fireEvent.click(nestedToggles[0]);

  expect(
    within(nestedGroup).getAllByRole("button", {
      name: "Toggle filter operator, currently and",
    }),
  ).toHaveLength(2);
  // Flip back to "or" inside nested group while root stays "and".
  fireEvent.click(
    within(nestedGroup).getAllByRole("button", {
      name: "Toggle filter operator, currently and",
    })[0],
  );
  expect(
    within(nestedGroup).getAllByRole("button", {
      name: "Toggle filter operator, currently or",
    }),
  ).toHaveLength(2);

  // Removing the nested group drops its conditions while keeping the root condition.
  fireEvent.click(
    within(nestedGroup).getByRole("button", { name: "Remove filter group" }),
  );
  expect(
    screen.getByRole("button", { name: "Advanced filter: 1 condition" }),
  ).toBeVisible();
  expect(screen.getByText("Size")).toBeInTheDocument();
  expect(screen.queryByText("Merge status")).not.toBeInTheDocument();

  // Adding a new nested group via "+ Filter group" creates a group with the opposite operator ("or").
  fireEvent.click(screen.getByRole("button", { name: "Filter group" }));
  const addedGroup = screen.getByRole("group", { name: "Filter group" });
  fireEvent.click(within(addedGroup).getByRole("button", { name: "Filter" }));
  fireEvent.click(await screen.findByText("Checks"));
  fireEvent.click(await screen.findByText("Failed"));
  expect(
    screen.getByRole("button", { name: "Advanced filter: 2 conditions" }),
  ).toBeVisible();
  expect(
    within(addedGroup).getByRole("button", {
      name: "Toggle filter operator, currently or",
    }),
  ).toBeInTheDocument();
});
