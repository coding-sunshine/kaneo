import { describe, expect, it } from "vite-plus/test";
import { requestedReviewers, rowActions } from "@/lib/review-row-actions";

describe("rowActions", () => {
  it("offers every write on an open pull request", () => {
    expect(rowActions({ status: "open", hasConflicts: false })).toEqual({
      edit: true,
      convertToDraft: true,
      squash: true,
      squashEnabled: true,
      close: true,
    });
  });
  it("disables squash on conflicts", () => {
    expect(rowActions({ status: "open", hasConflicts: true })).toMatchObject({
      squash: true,
      squashEnabled: false,
    });
  });
  it("offers no convert or squash on a draft", () => {
    expect(rowActions({ status: "draft", hasConflicts: false })).toMatchObject({
      edit: true,
      convertToDraft: false,
      squash: false,
      close: true,
    });
  });
  it.each(["merged", "closed"] as const)(
    "offers no write once %s",
    (status) => {
      expect(rowActions({ status, hasConflicts: false })).toEqual({
        edit: false,
        convertToDraft: false,
        squash: false,
        squashEnabled: true,
        close: false,
      });
    },
  );
});

describe("requestedReviewers", () => {
  it("drops people who already approved or asked for changes", () => {
    const person = (login: string) => ({ login, avatarUrl: "" });
    expect(
      requestedReviewers({
        reviewers: [person("a"), person("b"), person("c")],
        approvedBy: ["a"],
        changesRequestedBy: ["b"],
      }).map((p) => p.login),
    ).toEqual(["c"]);
  });
});
