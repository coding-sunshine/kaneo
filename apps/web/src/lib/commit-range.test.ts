import { expect, it } from "vite-plus/test";
import { nextRange } from "./commit-range";

it("starts, grows, shrinks and clears the range", () => {
  expect(nextRange(null, 3)).toEqual({ from: 3, to: 3 });
  expect(nextRange({ from: 3, to: 3 }, 5)).toEqual({ from: 3, to: 5 });
  expect(nextRange({ from: 3, to: 5 }, 1)).toEqual({ from: 1, to: 5 });
  expect(nextRange({ from: 1, to: 5 }, 1)).toEqual({ from: 2, to: 5 });
  expect(nextRange({ from: 1, to: 5 }, 5)).toEqual({ from: 1, to: 4 });
  expect(nextRange({ from: 1, to: 5 }, 3)).toEqual({ from: 1, to: 3 });
  expect(nextRange({ from: 3, to: 3 }, 3)).toBeNull();
});
