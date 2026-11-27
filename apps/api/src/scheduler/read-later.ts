/**
 * Reading a file needs the model, and the model cannot answer now: a cap is
 * used up, or `failed`, the request failed. Nothing is recorded; the file is
 * read again later.
 */
export class ReadLater extends Error {
  constructor(readonly failed: boolean) {
    super(
      failed ? "The model request failed" : "A cap of the model is used up",
    );
  }
}
