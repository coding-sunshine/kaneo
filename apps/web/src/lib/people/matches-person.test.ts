import { describe, expect, it } from "vite-plus/test";
import { matchesPerson } from "./matches-person";

const person = {
  name: "Sam Rivera",
  email: "sam@example.test",
  profile: {
    jobTitle: "Product Designer",
    department: null,
    location: "Lisbon",
    timeZone: "America/New_York",
  },
};

describe("matchesPerson", () => {
  it("matches everyone on an empty search", () => {
    expect(matchesPerson(person, "  ")).toBe(true);
  });

  it("matches the name, job title and location, ignoring case", () => {
    expect(matchesPerson(person, "rivera")).toBe(true);
    expect(matchesPerson(person, "product des")).toBe(true);
    expect(matchesPerson(person, "lisbon")).toBe(true);
  });

  it("matches a time zone typed with spaces", () => {
    expect(matchesPerson(person, "new york")).toBe(true);
    expect(matchesPerson(person, "America/New_York")).toBe(true);
    expect(matchesPerson(person, "america")).toBe(true);
  });

  it("does not match what is not there", () => {
    expect(matchesPerson(person, "engineer")).toBe(false);
    expect(matchesPerson({ ...person, profile: undefined }, "lisbon")).toBe(
      false,
    );
  });
});
