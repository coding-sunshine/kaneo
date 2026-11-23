import { beforeEach, expect, it } from "vite-plus/test";
import { readReviewed, writeReviewed } from "./reviewed-files";

const ref = { owner: "a", repo: "b", number: "1" };
beforeEach(() => localStorage.clear());

it("keeps ticks per head SHA, so a new push starts clean", () => {
  writeReviewed(ref, "sha1", ["x.ts"]);
  expect(readReviewed(ref, "sha1")).toEqual(["x.ts"]);
  expect(readReviewed(ref, "sha2")).toEqual([]);
  expect(readReviewed({ ...ref, number: "2" }, "sha1")).toEqual([]);
});

it("ignores damaged storage and a missing SHA", () => {
  localStorage.setItem("kaneo:reviewed:a/b#1@sha1", "{oops");
  expect(readReviewed(ref, "sha1")).toEqual([]);
  expect(readReviewed(ref, undefined)).toEqual([]);
});
