import { describe, expect, it } from "vite-plus/test";
import { readSlashCommand } from "./slash-command";

describe("readSlashCommand", () => {
  it("names a known command", () => {
    expect(readSlashCommand("/remind in 1 hour")).toEqual({ name: "remind" });
    expect(readSlashCommand(" /STATUS away")).toEqual({ name: "status" });
    expect(readSlashCommand("/ticket")).toEqual({ name: "ticket" });
  });

  it("flags an unknown command", () => {
    expect(readSlashCommand("/deploy now")).toEqual({ unknown: "deploy" });
  });

  it("leaves plain text and paths alone", () => {
    expect(readSlashCommand("hello /remind")).toBeNull();
    expect(readSlashCommand("/usr/bin is the path")).toBeNull();
    expect(readSlashCommand("/ just a slash")).toBeNull();
  });
});
