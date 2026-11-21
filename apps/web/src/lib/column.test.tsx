import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vite-plus/test";
import { StatusIcon } from "@/components/icons/status-icon";
import { getColumnIcon } from "./column";

describe("stored column icons", () => {
  it.each([
    "__proto__",
    "constructor",
    "toString",
    "hasOwnProperty",
    "unknown-icon",
  ])("uses safe fallbacks for %s", (name) => {
    expect(getColumnIcon("to-do", false, name).type).toBe(StatusIcon);
    expect(getColumnIcon("done", true, name).props.kind).toBe("done");
    expect(getColumnIcon(name, false).props.kind).toBe("todo");
    expect(() =>
      renderToStaticMarkup(getColumnIcon("to-do", false, name)),
    ).not.toThrow();
  });
  it("maps stock icons to Linear-style status kinds", () => {
    expect(getColumnIcon("to-do", false, "CircleDot").props.kind).toBe(
      "started",
    );
    expect(getColumnIcon("in-progress").props.kind).toBe("started");
    expect(getColumnIcon("in-review").props.kind).toBe("review");
    expect(getColumnIcon("done").props.kind).toBe("done");
    expect(getColumnIcon("planned").props.kind).toBe("backlog");
    expect(getColumnIcon("canceled", true).props.kind).toBe("canceled");
  });
  it("shows the inbox icon for triage even with the stored dashed default", () => {
    const inbox = getColumnIcon("triage").type;
    expect(inbox).not.toBe(StatusIcon);
    expect(getColumnIcon("triage", false, "CircleDashed").type).toBe(inbox);
  });
});
