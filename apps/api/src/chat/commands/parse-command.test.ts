import { describe, expect, it } from "vite-plus/test";
import { parseCommand } from "./parse-command";

const MINUTE = 60_000;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;

describe("parseCommand", () => {
  it("reads /remind with a delay and an optional note", () => {
    expect(parseCommand("/remind in 1 hour")).toEqual({
      name: "remind",
      delayMs: HOUR,
      note: "",
    });
    expect(
      parseCommand("/remind me in 30 minutes to check the deploy"),
    ).toEqual({
      name: "remind",
      delayMs: 30 * MINUTE,
      note: "check the deploy",
    });
    expect(parseCommand("/remind in an hour")).toMatchObject({ delayMs: HOUR });
    expect(parseCommand("/remind in 2d review")).toEqual({
      name: "remind",
      delayMs: 2 * DAY,
      note: "review",
    });
  });

  it("refuses a /remind it cannot time", () => {
    for (const text of [
      "/remind",
      "/remind tomorrow",
      "/remind in 0 minutes",
      "/remind in 2 fortnights",
      "/remind in 366 days",
    ])
      expect(parseCommand(text)).toEqual({
        error: "remind",
      });
  });

  it("reads /status, and clears it with nothing or clear", () => {
    expect(parseCommand("/status away")).toEqual({
      name: "status",
      text: "away",
    });
    expect(parseCommand("/status  in a meeting ")).toEqual({
      name: "status",
      text: "in a meeting",
    });
    expect(parseCommand("/status")).toEqual({ name: "status", text: null });
    expect(parseCommand("/status clear")).toEqual({
      name: "status",
      text: null,
    });
    expect(parseCommand(`/status ${"x".repeat(101)}`)).toEqual({
      error: "status",
    });
  });

  it("reads /ticket with a title", () => {
    expect(parseCommand("/ticket Fix login")).toEqual({
      name: "ticket",
      title: "Fix login",
    });
    expect(parseCommand("/ticket")).toEqual({ error: "ticket" });
  });

  it("names an unknown command", () => {
    expect(parseCommand("/deploy now")).toEqual({ error: "unknown" });
    expect(parseCommand("hello")).toEqual({ error: "unknown" });
  });
});
