import { beforeEach, expect, it, vi } from "vite-plus/test";
import { RefusedRequest, UnreadableAnswer } from "../agent/extraction";
import { seeWith } from "./file-vision";
import { ReadLater } from "./read-later";

const { extractJson, readsFiles } = vi.hoisted(() => ({
  extractJson: vi.fn(),
  readsFiles: vi.fn(),
}));
vi.mock("../agent/extraction", async (importOriginal) => ({
  ...(await importOriginal<object>()),
  extractJson,
  readsFiles,
}));

let n = 0;
// Each test its own bytes: what was written out is kept by their hash.
const file = () => ({
  bytes: new Uint8Array([n++, 1, 2]),
  mimeType: "image/png",
  filename: "scan.png",
});

beforeEach(() => {
  extractJson.mockReset();
  readsFiles.mockReset().mockResolvedValue(true);
});

it("writes out a file in as many answers as it needs, each one a question of the run", async () => {
  extractJson
    .mockResolvedValueOnce({ text: "First words.", more: true })
    .mockResolvedValueOnce({ text: "Last words.", more: false });
  const run = { parts: 5 };
  const scan = file();
  expect(await seeWith(0.3, run, "ws-1")(scan)).toBe(
    "First words.\nLast words.",
  );
  expect(run.parts).toBe(3);
  expect(extractJson.mock.calls[1]?.[0].text).toContain("First words.");
  // Written out once: the same bytes are not paid for again.
  expect(await seeWith(0.3, run, "ws-1")(scan)).toBe(
    "First words.\nLast words.",
  );
  expect(extractJson).toHaveBeenCalledTimes(2);
});

it("leaves the file for later when a cap or the run's questions are used up, or a request failed", async () => {
  await expect(seeWith(0.3, { parts: 0 }, "ws-1")(file())).rejects.toEqual(
    new ReadLater(false),
  );
  expect(extractJson).not.toHaveBeenCalled();
  extractJson.mockResolvedValueOnce(null);
  await expect(seeWith(0.3, { parts: 5 }, "ws-1")(file())).rejects.toEqual(
    new ReadLater(false),
  );
  extractJson.mockRejectedValueOnce(new Error("HTTP 503"));
  const failed = seeWith(0.3, { parts: 5 }, "ws-1")(file());
  await expect(failed).rejects.toBeInstanceOf(ReadLater);
  await expect(failed).rejects.toMatchObject({ failed: true });
});

it("gives up on a file the model refuses or answers about with no JSON", async () => {
  extractJson.mockRejectedValueOnce(new RefusedRequest("HTTP 413"));
  await expect(
    seeWith(0.3, { parts: 5 }, "ws-1")(file()),
  ).rejects.toBeInstanceOf(RefusedRequest);
  extractJson.mockRejectedValueOnce(new UnreadableAnswer("not JSON"));
  await expect(
    seeWith(0.3, { parts: 5 }, "ws-1")(file()),
  ).rejects.toBeInstanceOf(UnreadableAnswer);
});

it("leaves the file waiting, without asking, when the workspace's model reads no files", async () => {
  readsFiles.mockResolvedValue(false);
  const see = seeWith(0.3, { parts: 5 }, "ws-1");
  await expect(see(file())).rejects.toEqual(new ReadLater(false, true));
  await expect(see(file())).rejects.toMatchObject({ waits: true });
  expect(extractJson).not.toHaveBeenCalled();
  // Asked once per run of the workspace.
  expect(readsFiles).toHaveBeenCalledTimes(1);
  expect(readsFiles).toHaveBeenCalledWith("ws-1");
});
