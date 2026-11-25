import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "vite-plus/test";
import { HttpError } from "@/lib/http-error";
import { MAX_UPLOAD_BYTES } from "@/lib/upload-task-image";
import { uploadDocumentFile } from "@/lib/upload-document-file";

const mocks = vi.hoisted(() => ({
  createDocumentFileUpload: vi.fn(),
  finalizeDocumentFileUpload: vi.fn(),
}));

vi.mock("@/fetchers/document/documents", () => mocks);

const fetchMock = vi.fn();
const run = (file: File) =>
  uploadDocumentFile({ workspaceId: "ws-1", documentId: "doc-1", file });

describe("uploadDocumentFile", () => {
  beforeEach(() => {
    vi.stubGlobal("fetch", fetchMock);
    fetchMock.mockReset().mockResolvedValue({ ok: true });
    mocks.createDocumentFileUpload.mockReset().mockResolvedValue({
      key: "k-1",
      uploadUrl: "https://storage.test/put",
      headers: { "x-h": "v" },
    });
    mocks.finalizeDocumentFileUpload.mockReset().mockResolvedValue({
      id: "a-1",
      url: "https://files.test/a-1",
      kind: "image",
      mimeType: "image/png",
    });
  });
  afterEach(() => vi.unstubAllGlobals());

  it("uploads, finalizes and returns the server's kind and type", async () => {
    const file = new File(["abc"], "my-photo.png", { type: "" });
    const asset = await run(file);

    expect(mocks.createDocumentFileUpload).toHaveBeenCalledWith(
      "ws-1",
      "doc-1",
      { filename: "my-photo.png", size: 3 },
    );
    expect(fetchMock).toHaveBeenCalledWith("https://storage.test/put", {
      method: "PUT",
      headers: { "x-h": "v" },
      body: file,
    });
    expect(mocks.finalizeDocumentFileUpload).toHaveBeenCalledWith(
      "ws-1",
      "doc-1",
      { key: "k-1", filename: "my-photo.png", size: 3 },
    );
    expect(asset).toEqual({
      url: "https://files.test/a-1",
      alt: "my photo",
      filename: "my-photo.png",
      kind: "image",
      mimeType: "image/png",
      size: 3,
    });
  });

  it("refuses an empty file before any request", async () => {
    await expect(run(new File([], "a.pdf"))).rejects.toThrow(
      "Only non-empty file uploads are supported.",
    );
    expect(mocks.createDocumentFileUpload).not.toHaveBeenCalled();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("refuses a file over the limit before any request", async () => {
    const big = new File(["x"], "big.pdf");
    Object.defineProperty(big, "size", { value: MAX_UPLOAD_BYTES + 1 });
    await expect(run(big)).rejects.toThrow(/The limit is 50 MB per file/);
    expect(mocks.createDocumentFileUpload).not.toHaveBeenCalled();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("does not finalize when the storage PUT fails", async () => {
    fetchMock.mockResolvedValue({ ok: false });
    await expect(run(new File(["a"], "a.pdf"))).rejects.toThrow(
      "Failed to upload file to storage.",
    );
    expect(mocks.finalizeDocumentFileUpload).not.toHaveBeenCalled();
  });

  it("passes an HttpError from the upload request through", async () => {
    const error = new HttpError(415, "nope");
    mocks.createDocumentFileUpload.mockRejectedValue(error);
    await expect(run(new File(["a"], "a.exe"))).rejects.toBe(error);
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
