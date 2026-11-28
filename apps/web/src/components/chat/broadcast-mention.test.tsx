import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vite-plus/test";
import { MessageBody } from "./message-body";

afterEach(cleanup);

describe("broadcast mention", () => {
  it("highlights @here in a message", () => {
    render(<MessageBody body="@here deploy in 10 min" workspaceId="ws-1" />);
    const token = screen.getByText("@here");
    expect(token.tagName).toBe("MARK");
    expect(token.closest("p")?.textContent).toBe("@here deploy in 10 min");
  });
});
