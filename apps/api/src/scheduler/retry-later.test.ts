import { expect, it } from "vite-plus/test";
import { retryLater } from "./retry-later";

it("waits after a failed call", () => {
  const retry = retryLater(1000);
  expect(retry.waiting("a", 0)).toBe(false);
  retry.failed("a", 0);
  expect(retry.waiting("a", 0)).toBe(true);
  expect(retry.waiting("b", 0)).toBe(false);
  expect(retry.waiting("a", 999)).toBe(true);
  expect(retry.waiting("a", 1000)).toBe(false);
  retry.failed("a", 5000);
  retry.reset();
  expect(retry.waiting("a", 5000)).toBe(false);
});
