import assert from "node:assert/strict";
import { test } from "node:test";
import { pluralCategories } from "./plural-categories.mjs";

test("Vietnamese needs a one form on every Node version", () => {
  assert.deepEqual([...pluralCategories("vi-VN")].sort(), ["one", "other"]);
});

test("other locales keep the categories Intl reports", () => {
  assert.deepEqual([...pluralCategories("ja-JP")].sort(), ["other"]);
  assert.deepEqual([...pluralCategories("de-DE")].sort(), ["one", "other"]);
});

test("a locale Intl rejects is named in the error", () => {
  assert.throws(() => pluralCategories("not a locale"), /Unknown locale/);
});
