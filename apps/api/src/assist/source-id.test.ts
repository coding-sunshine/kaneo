import { describe, expect, it } from "vite-plus/test";
import { sourceId } from "./source-id";

describe("sourceId", () => {
  it("drops the brackets, quotes and kind a model copies around an id", () => {
    expect(sourceId(" [abc123] ")).toBe("abc123");
    expect(sourceId("(abc123)")).toBe("abc123");
    expect(sourceId("`abc123`")).toBe("abc123");
    expect(sourceId("comment:abc123")).toBe("abc123");
    expect(sourceId("[message: abc123]")).toBe("abc123");
  });

  it("keeps a ticket key and a plain id as they are", () => {
    expect(sourceId("PAY-1")).toBe("PAY-1");
    expect(sourceId("abc_12-x")).toBe("abc_12-x");
  });
});
