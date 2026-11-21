import { cleanup, render } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vite-plus/test";
import { Avatar, AvatarFallback } from "./avatar";

afterEach(cleanup);

const fallback = (children: React.ReactNode) =>
  render(
    <Avatar>
      <AvatarFallback>{children}</AvatarFallback>
    </Avatar>,
  ).container.querySelector<HTMLElement>("[data-slot=avatar-fallback]");

describe("AvatarFallback", () => {
  it("gives initials a stable color like Linear", () => {
    const first = fallback("DA")?.style.backgroundColor;
    cleanup();
    expect(first).toBeTruthy();
    expect(fallback("DA")?.style.backgroundColor).toBe(first);
  });

  it("leaves non-initials content on the default surface", () => {
    expect(fallback(<svg />)?.style.backgroundColor).toBe("");
  });
});
