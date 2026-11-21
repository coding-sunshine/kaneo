import { describe, expect, it } from "vite-plus/test";
import {
  applyThreadOverrides,
  defaultThreadSubscribers,
} from "./thread-subscribers";

describe("thread subscribers", () => {
  it("defaults to authors, mentioned users and the assignee", () => {
    const ids = defaultThreadSubscribers(
      [
        { userId: "a", content: "root" },
        { userId: "b", content: 'hi <kaneo-mention id="c"></kaneo-mention>' },
        { userId: null, content: null },
      ],
      "d",
    );
    expect([...ids].sort()).toEqual(["a", "b", "c", "d"]);
  });

  it("lets overrides add and remove subscribers", () => {
    const ids = applyThreadOverrides(new Set(["a", "b"]), [
      { userId: "a", subscribed: false },
      { userId: "z", subscribed: true },
    ]);
    expect([...ids].sort()).toEqual(["b", "z"]);
  });
});
