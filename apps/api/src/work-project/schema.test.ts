import { describe, expect, it } from "vite-plus/test";
import {
  createMilestoneBody,
  createWorkProjectBody,
  updateWorkProjectBody,
} from "./schema";

describe("work project schemas", () => {
  it("trims names and rejects blank ones", () => {
    const ok = createWorkProjectBody.parse({
      workspaceId: "w",
      name: "  Roadmap ",
    });
    expect(ok.name).toBe("Roadmap");
    expect(
      createWorkProjectBody.safeParse({ workspaceId: "w", name: "  " }).success,
    ).toBe(false);
    expect(createMilestoneBody.safeParse({ name: "" }).success).toBe(false);
  });

  it("accepts only Linear's project statuses, health values and priorities", () => {
    const parse = (extra: object) =>
      createWorkProjectBody.safeParse({ workspaceId: "w", name: "P", ...extra })
        .success;
    expect(parse({ status: "started", health: "atRisk", priority: 4 })).toBe(
      true,
    );
    expect(parse({ status: "done" })).toBe(false);
    expect(parse({ health: "fine" })).toBe(false);
    expect(parse({ priority: 5 })).toBe(false);
  });

  it("allows partial updates and null to clear dates", () => {
    expect(updateWorkProjectBody.parse({})).toEqual({});
    expect(updateWorkProjectBody.parse({ targetDate: null })).toEqual({
      targetDate: null,
    });
  });
});
