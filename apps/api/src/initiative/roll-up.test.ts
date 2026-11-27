import { describe, expect, it } from "vite-plus/test";
import { rollUpHealth, rollUpProgress } from "./roll-up";

const project = (health: string | null, status = "started") => ({
  health,
  status,
});

describe("rollUpHealth", () => {
  it("is null when nothing has an update", () => {
    expect(rollUpHealth(null, [project(null)])).toBeNull();
  });

  it("takes the worst of the initiative and its projects", () => {
    expect(rollUpHealth("onTrack", [project("atRisk")])).toBe("atRisk");
    expect(rollUpHealth("offTrack", [project("onTrack")])).toBe("offTrack");
    expect(rollUpHealth(null, [project("onTrack"), project("atRisk")])).toBe(
      "atRisk",
    );
  });

  it("leaves out completed and canceled projects", () => {
    expect(
      rollUpHealth("onTrack", [
        project("offTrack", "completed"),
        project("offTrack", "canceled"),
      ]),
    ).toBe("onTrack");
  });
});

describe("rollUpProgress", () => {
  it("adds up the projects' issues", () => {
    expect(
      rollUpProgress([
        { progress: { total: 4, done: 1 } },
        { progress: { total: 6, done: 5 } },
      ]),
    ).toEqual({ total: 10, done: 6 });
    expect(rollUpProgress([])).toEqual({ total: 0, done: 0 });
  });
});
