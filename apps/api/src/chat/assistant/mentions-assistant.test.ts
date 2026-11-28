import { describe, expect, it } from "vite-plus/test";
import { mentionsAssistant } from "./mentions-assistant";

describe("mentionsAssistant", () => {
  it("finds @assistant as a word of its own, in any case", () => {
    expect(mentionsAssistant("@assistant summarise this")).toBe(true);
    expect(mentionsAssistant("hey @Assistant, what is open?")).toBe(true);
    expect(mentionsAssistant("(@assistant)")).toBe(true);
  });

  it("ignores an address, a longer handle and plain text", () => {
    expect(mentionsAssistant("mail ops@assistant.example")).toBe(false);
    expect(mentionsAssistant("@assistants are people")).toBe(false);
    expect(mentionsAssistant("ask the assistant")).toBe(false);
  });
});
