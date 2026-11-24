import { afterEach, beforeEach, expect, it, vi } from "vite-plus/test";
import { toast } from "@/lib/toast";
import { copyTextAsync } from "./copy-text";

vi.mock("@/lib/toast", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

const writeText = vi.fn().mockResolvedValue(undefined);
const write = vi.fn().mockResolvedValue(undefined);

beforeEach(() => {
  vi.clearAllMocks();
  Object.defineProperty(navigator, "clipboard", {
    value: { writeText, write },
    configurable: true,
  });
});
afterEach(() => vi.unstubAllGlobals());

it("starts the clipboard write before the text is ready when ClipboardItem exists", async () => {
  class Item {
    constructor(public items: Record<string, Promise<Blob>>) {}
  }
  vi.stubGlobal("ClipboardItem", Item);
  let resolve: (text: string) => void = () => {};
  const text = new Promise<string>((r) => {
    resolve = r;
  });
  const done = copyTextAsync(text, "ok", "no", "gen");
  expect(write).toHaveBeenCalledOnce();
  resolve("hello");
  await done;
  const item = write.mock.calls[0][0][0] as Item;
  expect(await (await item.items["text/plain"]).text()).toBe("hello");
  expect(toast.success).toHaveBeenCalledWith("ok");
});

it("waits and writes text without ClipboardItem", async () => {
  vi.stubGlobal("ClipboardItem", undefined);
  await copyTextAsync(Promise.resolve("hi"), "ok", "no", "gen");
  expect(writeText).toHaveBeenCalledWith("hi");
  expect(toast.success).toHaveBeenCalledWith("ok");
});

it("tells a generation failure from a clipboard failure", async () => {
  vi.stubGlobal("ClipboardItem", undefined);
  await copyTextAsync(Promise.reject(new Error("x")), "ok", "no", "gen");
  expect(toast.error).toHaveBeenLastCalledWith("gen");
  writeText.mockRejectedValueOnce(new Error("denied"));
  await copyTextAsync(Promise.resolve("hi"), "ok", "no", "gen");
  expect(toast.error).toHaveBeenLastCalledWith("no");
});

it("fails cleanly, with no unhandled rejection, when there is no clipboard", async () => {
  vi.stubGlobal("ClipboardItem", undefined);
  Object.defineProperty(navigator, "clipboard", {
    value: undefined,
    configurable: true,
  });
  const unhandled = vi.fn();
  process.on("unhandledRejection", unhandled);
  let reject: (error: Error) => void = () => {};
  const text = new Promise<string>((_, r) => {
    reject = r;
  });
  const done = copyTextAsync(text, "ok", "no", "gen");
  reject(new Error("x"));
  await done;
  await new Promise((r) => setTimeout(r, 0));
  process.off("unhandledRejection", unhandled);
  expect(toast.error).toHaveBeenLastCalledWith("gen");
  expect(unhandled).not.toHaveBeenCalled();
});
