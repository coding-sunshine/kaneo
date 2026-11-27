import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
} from "@testing-library/react";
import { type ReactNode, useRef } from "react";
import { afterEach, describe, expect, it, vi } from "vite-plus/test";
import { DocumentOutline } from "./document-outline";

vi.mock("react-i18next", () => ({
  useTranslation: () => ({ t: (key: string) => key }),
  initReactI18next: { type: "3rdParty", init: () => {} },
}));

function Page({ body }: { body: ReactNode }) {
  const scrollRef = useRef<HTMLDivElement>(null);
  return (
    <div>
      <div ref={scrollRef} data-testid="scroller">
        <div className="ProseMirror">{body}</div>
      </div>
      <DocumentOutline scrollRef={scrollRef} />
    </div>
  );
}

const BODY = (
  <>
    <h1>Overview</h1>
    <p>text</p>
    <h2>Benefits</h2>
    <p>more</p>
    <h3>Risks</h3>
  </>
);

const placeAt = (element: Element, top: number) => {
  element.getBoundingClientRect = () => ({ top }) as DOMRect;
};

afterEach(cleanup);

describe("DocumentOutline", () => {
  it("shows one dash per heading in the body, named for screen readers", () => {
    render(<Page body={BODY} />);
    const items = screen.getAllByRole("button");
    expect(items.map((item) => item.getAttribute("aria-label"))).toEqual([
      "Overview",
      "Benefits",
      "Risks",
    ]);
  });

  it("scrolls to the heading that was clicked", () => {
    render(<Page body={BODY} />);
    const heading = screen.getByRole("heading", { name: "Benefits" });
    heading.scrollIntoView = vi.fn();
    fireEvent.click(screen.getByRole("button", { name: "Benefits" }));
    expect(heading.scrollIntoView).toHaveBeenCalledWith(
      expect.objectContaining({ block: "start" }),
    );
  });

  it("marks the section in view and follows scrolling", () => {
    render(<Page body={BODY} />);
    const scroller = screen.getByTestId("scroller");
    placeAt(scroller, 0);
    placeAt(screen.getByRole("heading", { name: "Overview" }), -400);
    placeAt(screen.getByRole("heading", { name: "Benefits" }), 40);
    placeAt(screen.getByRole("heading", { name: "Risks" }), 600);
    act(() => {
      fireEvent.scroll(scroller);
    });
    expect(
      screen
        .getByRole("button", { name: "Benefits" })
        .getAttribute("aria-current"),
    ).toBe("location");
    expect(
      screen
        .getByRole("button", { name: "Overview" })
        .hasAttribute("aria-current"),
    ).toBe(false);
  });

  it("marks the last heading once the page is scrolled to the end", () => {
    render(<Page body={BODY} />);
    const scroller = screen.getByTestId("scroller");
    placeAt(scroller, 0);
    placeAt(screen.getByRole("heading", { name: "Overview" }), -800);
    placeAt(screen.getByRole("heading", { name: "Benefits" }), -300);
    placeAt(screen.getByRole("heading", { name: "Risks" }), 500);
    for (const [name, value] of [
      ["scrollTop", 1200],
      ["clientHeight", 800],
      ["scrollHeight", 2000],
    ] as const) {
      Object.defineProperty(scroller, name, { configurable: true, value });
    }
    act(() => {
      fireEvent.scroll(scroller);
    });
    expect(
      screen
        .getByRole("button", { name: "Risks" })
        .getAttribute("aria-current"),
    ).toBe("location");
  });

  it("shows nothing when the document has no headings", () => {
    render(<Page body={<p>Only text</p>} />);
    expect(screen.queryByRole("navigation")).toBeNull();
  });
});
