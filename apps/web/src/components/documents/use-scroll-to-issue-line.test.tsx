import { render } from "@testing-library/react";
import { useRef } from "react";
import { afterEach, expect, it, vi } from "vite-plus/test";
import { useScrollToIssueLine } from "./use-scroll-to-issue-line";

function Body() {
  const ref = useRef<HTMLDivElement>(null);
  useScrollToIssueLine(ref);
  return (
    <div ref={ref}>
      <ul>
        <li>
          <a href="/dashboard/workspace/w/project/p/task/abc123">ALP-1</a>
        </li>
      </ul>
    </div>
  );
}

afterEach(() => {
  window.location.hash = "";
});

it("scrolls to the line of the issue named in the address", async () => {
  const scroll = vi.fn();
  Element.prototype.scrollIntoView = scroll;
  window.location.hash = "#issue-abc123";
  render(<Body />);
  await vi.waitFor(() => expect(scroll).toHaveBeenCalled());
  expect(scroll).toHaveBeenCalledWith({ block: "center" });
});

it("does nothing for another address", async () => {
  const scroll = vi.fn();
  Element.prototype.scrollIntoView = scroll;
  window.location.hash = "#other";
  render(<Body />);
  await new Promise((resolve) => setTimeout(resolve, 150));
  expect(scroll).not.toHaveBeenCalled();
});
