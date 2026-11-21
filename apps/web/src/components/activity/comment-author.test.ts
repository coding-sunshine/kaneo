import { describe, expect, it } from "vite-plus/test";
import { commentAuthor } from "./comment-author";

const members = [
  { user: { id: "u1", name: "Hardik", email: "h@example.com", image: null } },
];
const labels = { someone: "Someone", externalUser: "GitHub User" };

describe("commentAuthor", () => {
  it("shows an imported comment under its original author", () => {
    expect(
      commentAuthor(
        {
          userId: "u1",
          externalSource: "linear",
          externalUserName: "Azhar",
          externalUserAvatar: "https://avatar",
        },
        members,
        labels,
      ),
    ).toEqual({
      user: {
        id: undefined,
        name: "Azhar",
        email: undefined,
        image: "https://avatar",
      },
      importedBy: "Hardik",
    });
  });

  it("does not name an importer for synced GitHub comments", () => {
    expect(
      commentAuthor({ userId: "u1", externalSource: "github" }, members, labels)
        .importedBy,
    ).toBeUndefined();
  });

  it("uses the workspace member for native comments", () => {
    expect(commentAuthor({ userId: "u1" }, members, labels).user).toEqual({
      id: "u1",
      name: "Hardik",
      email: "h@example.com",
      image: null,
    });
  });
});
