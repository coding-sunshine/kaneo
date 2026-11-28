import { beforeEach, describe, expect, it, vi } from "vite-plus/test";
import { uploadChatFiles } from "./upload-chat-files";

const { uploadChatFile } = vi.hoisted(() => ({ uploadChatFile: vi.fn() }));
vi.mock("./upload-chat-file", () => ({ uploadChatFile }));

const file = (name: string) => new File(["x"], name);

describe("uploadChatFiles", () => {
  beforeEach(() => {
    uploadChatFile.mockReset();
    uploadChatFile.mockResolvedValue({ id: "message-1" });
  });

  it("posts the first file with the text and adds the rest to that message", async () => {
    await uploadChatFiles({
      workspaceId: "ws",
      channelId: "channel-1",
      files: [file("chart.png"), file("report.pdf")],
      body: "the numbers",
    });

    expect(uploadChatFile.mock.calls.map(([call]) => call)).toEqual([
      {
        workspaceId: "ws",
        channelId: "channel-1",
        file: expect.objectContaining({ name: "chart.png" }),
        body: "the numbers",
      },
      {
        workspaceId: "ws",
        channelId: "channel-1",
        file: expect.objectContaining({ name: "report.pdf" }),
        messageId: "message-1",
      },
    ]);
  });

  it("stops at the first file that fails", async () => {
    uploadChatFile.mockRejectedValueOnce(new Error("Too big"));
    await expect(
      uploadChatFiles({
        workspaceId: "ws",
        channelId: "channel-1",
        files: [file("huge.pdf"), file("report.pdf")],
      }),
    ).rejects.toThrow("Too big");
    expect(uploadChatFile).toHaveBeenCalledTimes(1);
  });
});
