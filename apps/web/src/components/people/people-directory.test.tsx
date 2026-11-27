import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vite-plus/test";
import type { Person } from "./person-card";
import { PeopleDirectory } from "./people-directory";

const empty = {
  jobTitle: null,
  department: null,
  location: null,
  timeZone: null,
  status: null,
  outOfOffice: null,
};
const people: Person[] = [
  {
    id: "user-1",
    name: "Avery",
    email: "avery@example.test",
    image: null,
    profile: {
      ...empty,
      jobTitle: "Platform engineer",
      timeZone: "Australia/Sydney",
      status: { text: "In a meeting", clearsAt: null },
      outOfOffice: {
        from: "2026-11-30T00:00:00.000Z",
        until: "2026-12-04T23:59:59.999Z",
      },
    },
  },
  {
    id: "user-2",
    name: "Blake",
    email: "blake@example.test",
    image: null,
    profile: { ...empty, jobTitle: "Designer", timeZone: "Europe/Berlin" },
  },
];

const names = () =>
  screen.queryAllByRole("heading").map((heading) => heading.textContent);
const search = (value: string) =>
  fireEvent.change(screen.getByLabelText("team:people.searchLabel"), {
    target: { value },
  });

afterEach(cleanup);

describe("PeopleDirectory", () => {
  it("lists everyone with their status and out-of-office range", () => {
    render(<PeopleDirectory people={people} />);
    expect(names()).toEqual(["Avery", "Blake"]);
    const [avery] = screen.getAllByRole("listitem");
    expect(avery).toHaveTextContent("In a meeting");
    expect(avery).toHaveTextContent("team:people.outOfOfficeRange");
  });

  it("searches by job title and by time zone", () => {
    render(<PeopleDirectory people={people} />);
    search("designer");
    expect(names()).toEqual(["Blake"]);
    search("sydney");
    expect(names()).toEqual(["Avery"]);
    search("nobody here");
    expect(names()).toEqual([]);
    expect(screen.getByText("team:people.empty")).toBeInTheDocument();
  });

  it("does not show a field the person left empty", () => {
    render(<PeopleDirectory people={people} />);
    const [, blake] = screen.getAllByRole("listitem");
    expect(blake).toHaveTextContent("team:people.jobTitle");
    expect(blake).toHaveTextContent("team:people.timeZone");
    expect(blake).not.toHaveTextContent("team:people.department");
    expect(blake).not.toHaveTextContent("team:people.location");
    expect(blake).not.toHaveTextContent("team:people.outOfOfficeRange");
  });
});
