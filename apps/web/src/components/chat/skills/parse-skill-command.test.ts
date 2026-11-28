import { describe, expect, it } from "vite-plus/test";
import { parseSkillCommand } from "./parse-skill-command";

describe("parseSkillCommand", () => {
  it("reads the name and the rest as input", () => {
    expect(parseSkillCommand("/blockers this week")).toEqual({
      name: "blockers",
      input: "this week",
    });
    expect(parseSkillCommand(" /blockers ")).toEqual({
      name: "blockers",
      input: undefined,
    });
  });

  it("is null for ordinary messages and paths", () => {
    expect(parseSkillCommand("hello /blockers")).toBeNull();
    expect(parseSkillCommand("/usr/local/bin")).toBeNull();
    expect(parseSkillCommand("/Blockers")).toBeNull();
  });
});
