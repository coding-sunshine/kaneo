import { cleanup, render } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it } from "vite-plus/test";
import { useInstanceNameStore } from "@/store/instance-name";
import PageTitle from "./page-title";

describe("PageTitle", () => {
  beforeEach(() => {
    document.title = "Organyz Work";
  });

  afterEach(() => {
    cleanup();
    useInstanceNameStore.setState({ instanceName: "Organyz Work" });
  });

  it("uses the custom instance name and restores the fallback on unmount", () => {
    useInstanceNameStore.setState({ instanceName: "Acme" });
    const { unmount } = render(<PageTitle title="Settings" />);
    expect(document.title).toBe("Settings | Acme");
    unmount();
    expect(document.title).toBe("Organyz Work");
  });

  it("sets the document title", () => {
    render(<PageTitle title="MFP-1 Drag this card" />);
    expect(document.title).toBe("MFP-1 Drag this card");
  });

  it("keeps the fallback title while the title is still loading", () => {
    const { rerender } = render(<PageTitle title={undefined} />);
    expect(document.title).toBe("Organyz Work");

    rerender(<PageTitle title="Website / Board" />);
    expect(document.title).toBe("Website / Board");
  });

  it("restores the fallback title when the page unmounts", () => {
    const { unmount } = render(<PageTitle title="Inbox" />);
    unmount();
    expect(document.title).toBe("Organyz Work");
  });
});
