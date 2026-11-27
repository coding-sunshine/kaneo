import { describe, expect, it } from "vite-plus/test";
import {
  buildCodingToolUrl,
  DEFAULT_CODING_TOOLS,
  isSafeCodingToolUrl,
  sanitizeCodingTools,
} from "./coding-tools";

const pull = {
  owner: "acme",
  repo: "web",
  number: 42,
  title: "Fix login",
  url: "https://github.com/acme/web/pull/42",
  headRef: "feat/login",
};

describe("coding-tools", () => {
  it("accepts editor and http/https schemes and rejects unsafe schemes", () => {
    expect(
      isSafeCodingToolUrl("cursor://vscode.git/clone?url=https://a/b.git"),
    ).toBe(true);
    expect(isSafeCodingToolUrl("https://github.dev/acme/web/pull/42")).toBe(
      true,
    );
    expect(isSafeCodingToolUrl("javascript:alert(1)")).toBe(false);
    expect(isSafeCodingToolUrl("data:text/html,<script>1</script>")).toBe(
      false,
    );
    expect(isSafeCodingToolUrl("vbscript:msgbox(1)")).toBe(false);
    expect(isSafeCodingToolUrl("not a url")).toBe(false);
  });

  it("expands pull request placeholders into safe URLs", () => {
    expect(
      buildCodingToolUrl(
        "https://ide.example.com/{owner}/{repo}/pull/{number}?branch={branch}",
        pull,
      ),
    ).toBe("https://ide.example.com/acme/web/pull/42?branch=feat%2Flogin");
    expect(buildCodingToolUrl("javascript:alert({number})", pull)).toBeNull();
  });

  it("sanitizes saved tools, keeping built-in toggle state and valid custom tools", () => {
    expect(sanitizeCodingTools(undefined)).toEqual(DEFAULT_CODING_TOOLS);
    const sanitized = sanitizeCodingTools([
      {
        id: "cursor",
        name: "Cursor",
        urlTemplate: "cursor://x",
        enabled: false,
        builtin: true,
      },
      {
        id: "my-tool",
        name: "My IDE",
        urlTemplate: "https://ide.example.com/{owner}/{repo}",
        enabled: true,
      },
      {
        id: "evil",
        name: "Evil",
        urlTemplate: "javascript:alert(1)",
        enabled: true,
      },
    ]);
    expect(sanitized.find((t) => t.id === "cursor")?.enabled).toBe(false);
    expect(sanitized.find((t) => t.id === "vscode")?.enabled).toBe(true);
    expect(sanitized.find((t) => t.id === "my-tool")).toEqual({
      id: "my-tool",
      name: "My IDE",
      urlTemplate: "https://ide.example.com/{owner}/{repo}",
      enabled: true,
    });
    expect(sanitized.find((t) => t.id === "evil")).toBeUndefined();
  });
});
