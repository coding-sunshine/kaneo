import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vite-plus/test";
import { ReviewsConnectCard } from "./reviews-connect-card";

afterEach(cleanup);

describe("ReviewsConnectCard", () => {
  it("links the connect action to the API with the return path", () => {
    render(
      <ReviewsConnectCard
        state="not_connected"
        returnTo="/dashboard/w/reviews"
      />,
    );
    const link = screen.getByRole("link", {
      name: "workspace:reviews.connect.action",
    });
    const href = link.getAttribute("href") ?? "";
    expect(href).toContain("/api/github-reviews/connect?returnTo=");
    expect(decodeURIComponent(href)).toContain("returnTo=/dashboard/w/reviews");
  });

  it("uses the reconnect copy when the token is dead", () => {
    render(<ReviewsConnectCard state="needs_reconnect" returnTo="/x" />);
    expect(
      screen.getByText("workspace:reviews.reconnect.title"),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: "workspace:reviews.reconnect.action" }),
    ).toBeInTheDocument();
  });

  it("shows no action when the instance is not configured", () => {
    render(<ReviewsConnectCard state="not_configured" returnTo="/x" />);
    expect(
      screen.getByText("workspace:reviews.notConfigured.title"),
    ).toBeInTheDocument();
    expect(screen.queryByRole("link")).not.toBeInTheDocument();
  });
});
