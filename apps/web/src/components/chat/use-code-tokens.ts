import { useEffect, useState } from "react";
import type { Token } from "@/components/reviews/code-highlight";
import { detectCodeLanguage } from "@/components/editor/detect-code-language";

// Fence labels people type that shiki names differently.
const ALIASES: Record<string, string> = {
  ts: "typescript",
  js: "javascript",
  sh: "bash",
  shell: "bash",
  zsh: "bash",
  py: "python",
  rb: "ruby",
  rs: "rust",
  yml: "yaml",
  md: "markdown",
  cs: "csharp",
  "c++": "cpp",
};

/** Syntax colours for each line of a code block; null until shiki is ready. */
export function useCodeTokens(code: string, language: string) {
  const [tokens, setTokens] = useState<Token[][] | null>(null);
  useEffect(() => {
    const label = language.toLowerCase();
    const wanted = ALIASES[label] ?? (label || detectCodeLanguage(code));
    if (!wanted) {
      setTokens(null);
      return;
    }
    let stale = false;
    void (async () => {
      const { getSharedShikiHighlighter } =
        await import("@/lib/shiki-highlighter");
      const highlighter = await getSharedShikiHighlighter();
      let lang = wanted;
      if (!highlighter.getLoadedLanguages().includes(lang)) {
        await highlighter.loadLanguage(lang as never).catch(() => {
          lang = "text";
        });
      }
      const theme = document.documentElement.classList.contains("dark")
        ? "github-dark"
        : "github-light";
      const result = highlighter.codeToTokens(code, {
        lang: lang as never,
        theme: theme as never,
      });
      if (!stale) setTokens(result.tokens);
    })().catch(() => {
      if (!stale) setTokens(null);
    });
    return () => {
      stale = true;
    };
  }, [code, language]);
  return tokens;
}
