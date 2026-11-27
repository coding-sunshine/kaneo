/**
 * Reading a file needs the model, and the model cannot answer now: a cap is
 * used up, or `failed`, the request failed, or `waits`, the workspace's model
 * reads no files. Nothing is recorded; the file is read again later. Only a
 * file that waits lets the run go on with the next text.
 */
export class ReadLater extends Error {
  constructor(
    readonly failed: boolean,
    readonly waits = false,
  ) {
    super(
      waits
        ? "The workspace's model reads no files"
        : failed
          ? "The model request failed"
          : "A cap of the model is used up",
    );
  }
}
