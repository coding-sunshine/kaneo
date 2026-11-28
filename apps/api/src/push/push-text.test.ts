import { describe, expect, it } from "vite-plus/test";
import { chatPushText } from "./push-text";

describe("chat push text", () => {
  it("names the channel and the author in a channel", () => {
    expect(
      chatPushText({
        channelName: "general",
        isDirect: false,
        authorName: "Writer",
        body: "Ship it",
        filename: null,
      }),
    ).toEqual({ title: "#general", body: "Writer: Ship it" });
  });

  it("names only the author in a direct message", () => {
    expect(
      chatPushText({
        channelName: "dm-key",
        isDirect: true,
        authorName: "Writer",
        body: "Ship it",
        filename: null,
      }),
    ).toEqual({ title: "Writer", body: "Ship it" });
  });

  it("shows mentions by name and drops other markup", () => {
    expect(
      chatPushText({
        channelName: "general",
        isDirect: true,
        authorName: "Writer",
        body: 'Hi <kaneo-mention id="u1" label="Reader">@Reader</kaneo-mention>,\n\n<b>look</b>',
        filename: null,
      }).body,
    ).toBe("Hi @Reader, look");
  });

  it("falls back to the file name for a file without text", () => {
    expect(
      chatPushText({
        channelName: "general",
        isDirect: true,
        authorName: "Writer",
        body: "",
        filename: "plan.pdf",
      }).body,
    ).toBe("plan.pdf");
  });

  it("keeps the text short", () => {
    const { body } = chatPushText({
      channelName: "general",
      isDirect: true,
      authorName: "Writer",
      body: "x".repeat(500),
      filename: null,
    });
    expect(body.length).toBe(180);
    expect(body.endsWith("…")).toBe(true);
  });
});
