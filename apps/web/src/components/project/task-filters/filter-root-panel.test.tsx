import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vite-plus/test";
import { FilterRootPanel } from "./filter-root-panel";

vi.mock("react-i18next", async (importOriginal) => ({
  ...(await importOriginal<typeof import("react-i18next")>()),
  useTranslation: () => ({
    t: (key: string, values?: { text?: string }) =>
      values?.text ? `${key}:${values.text}` : key,
  }),
}));

afterEach(cleanup);

const type = (text: string) =>
  fireEvent.change(screen.getByPlaceholderText("tasks:filterMenu.addFilter"), {
    target: { value: text },
  });

it("offers to read a typed sentence as a filter, and sends the sentence", () => {
  const onAsk = vi.fn();
  const onApplied = vi.fn();
  render(<FilterRootPanel subjects={[]} onAsk={onAsk} onApplied={onApplied} />);
  type("bug");
  expect(screen.queryByText(/askAi/)).toBeNull();
  type("my blocked bugs older than 2 weeks");
  fireEvent.click(
    screen.getByText(
      "tasks:filterMenu.askAi:my blocked bugs older than 2 weeks",
    ),
  );
  expect(onAsk).toHaveBeenCalledWith("my blocked bugs older than 2 weeks");
  expect(onApplied).toHaveBeenCalled();
});

it("offers nothing without AI", () => {
  render(<FilterRootPanel subjects={[]} />);
  type("my blocked bugs");
  expect(screen.queryByText(/askAi/)).toBeNull();
});
