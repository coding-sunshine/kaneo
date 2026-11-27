import { describe, expect, it } from "vite-plus/test";
import {
  findDocumentIds,
  findProjectIds,
  findTaskReferences,
  mentionsDocument,
} from "./find-links";

const at = (workspace: string, id: string) =>
  `https://tracker.example/dashboard/workspace/${workspace}/document/${id}`;

describe("findDocumentIds", () => {
  it("reads document addresses of the workspace, each once", () => {
    const text = [
      `<a href="${at("ws-1", "abc123")}">plan</a>`,
      `[notes](${at("ws-1", "def456")})`,
      `<kaneo-document-link url="${at("ws-1", "abc123")}" />`,
      at("ws-2", "other1"),
    ].join(" ");

    expect(findDocumentIds(text, "ws-1")).toEqual(["abc123", "def456"]);
    expect(findDocumentIds(text, "ws-2")).toEqual(["other1"]);
  });

  it("reads nothing from a list page or a malformed id", () => {
    expect(
      findDocumentIds(
        "/workspace/ws-1/documents /workspace/ws-1/document/ /workspace/ws-1/document/abcDEF",
        "ws-1",
      ),
    ).toEqual([]);
  });

  it("tells cheaply whether a text can hold an address", () => {
    expect(mentionsDocument(at("ws-1", "abc123"))).toBe(true);
    expect(mentionsDocument("<p>No link, only documents.</p>")).toBe(false);
    expect(mentionsDocument(null)).toBe(false);
  });
});

describe("findTaskReferences", () => {
  it("reads the id from a full address and the key from a short one", () => {
    expect(
      findTaskReferences(
        '<a href="/dashboard/workspace/ws-1/project/p1/task/abc123">x</a> ' +
          "https://tracker.example/acme/task/eng-12/fix-the-login?tab=1 " +
          "/acme/task/my-team-7 /acme/task/%C3%A9quipe-3",
      ),
    ).toEqual({
      ids: ["abc123"],
      keys: [
        { key: "eng", number: 12 },
        { key: "my-team", number: 7 },
        { key: "équipe", number: 3 },
      ],
    });
  });

  it("reads a key typed into the words, and only a whole one", () => {
    expect(
      findTaskReferences(
        "<p>See ENG-12, (OPS-3) and eng-12. Not pre-eng-4, ENG-5x, ENG-6-7, _ENG-8 or ENG-.</p>",
      ).keys,
    ).toEqual([
      { key: "eng", number: 12 },
      { key: "OPS", number: 3 },
    ]);
  });

  it("does not read markup, and no number too long for an issue", () => {
    expect(
      findTaskReferences(
        '<p class="mt-4" data-row="ENG-9">ENG-1234567890 /task/ENG-1234567890</p>',
      ),
    ).toEqual({ ids: [], keys: [] });
  });
});

describe("findProjectIds", () => {
  const team = (workspace: string, id: string, rest = "") =>
    `https://tracker.example/dashboard/workspace/${workspace}/project/${id}${rest}`;

  it("reads team addresses of the workspace, each once", () => {
    const text = [
      `<a href="${team("ws-1", "abc123", "/board")}">board</a>`,
      team("ws-1", "abc123", "/list?view=1"),
      team("ws-1", "def456"),
      team("ws-2", "other1", "/board"),
    ].join(" ");

    expect(findProjectIds(text, "ws-1")).toEqual(["abc123", "def456"]);
    expect(findProjectIds(text, "ws-2")).toEqual(["other1"]);
  });

  it("does not read the team out of a ticket address", () => {
    expect(
      findProjectIds(team("ws-1", "abc123", "/task/xyz789"), "ws-1"),
    ).toEqual([]);
  });
});
