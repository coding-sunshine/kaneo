import { describe, expect, it } from "vite-plus/test";
import en from "../../../../../i18n/en-US.json";
import { LOOP_ACTIONS, LOOP_TEMPLATES } from "./loop-templates";

describe("weekly digest loop template", () => {
  it("runs weekly and may only draft the digest", () => {
    const digest = LOOP_TEMPLATES.find((template) => template.id === "digest");
    expect(digest).toMatchObject({
      trigger: "schedule",
      frequency: "weekly",
      actions: ["draft_weekly_digest"],
    });
    expect(en.navigation.loops.templates.digest.title).toBe("Weekly digest");
  });

  it("names every action a loop may take", () => {
    for (const action of LOOP_ACTIONS) {
      expect(en.navigation.loops.action[action], action).toBeTruthy();
    }
  });
});
