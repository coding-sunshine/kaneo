import { useEffect, useState } from "react";
import type { DiffLine } from "@/components/reviews/diff-parser";
import {
  type CodeTheme,
  languageFor,
  THEME_NAMES,
  type Token,
} from "@/components/reviews/code-highlight";

/** Syntax colours for each code line of a diff, by line id; empty until shiki is ready. */
export function useLineTokens(
  lines: DiffLine[],
  filename: string,
  theme: CodeTheme,
) {
  const [tokens, setTokens] = useState(new Map<number, Token[]>());
  useEffect(() => {
    const lang = languageFor(filename);
    const code = lines.filter((line) => line.kind !== "hunk");
    if (!lang || code.length === 0) {
      setTokens(new Map());
      return;
    }
    let stale = false;
    void (async () => {
      const { getSharedShikiHighlighter } =
        await import("@/lib/shiki-highlighter");
      const highlighter = await getSharedShikiHighlighter();
      const name =
        THEME_NAMES[theme][
          document.documentElement.classList.contains("dark") ? "dark" : "light"
        ];
      await highlighter.loadTheme(name as never);
      if (!highlighter.getLoadedLanguages().includes(lang)) {
        await highlighter.loadLanguage(lang as never);
      }
      // ponytail: old and new lines are tokenised as one text, so a string or comment
      // that spans lines can colour the wrong side. Tokenise each side apart if it shows.
      const rows = highlighter.codeToTokensBase(
        code.map((line) => line.text).join("\n"),
        { lang: lang as never, theme: name as never },
      );
      if (!stale) {
        setTokens(
          new Map(code.map((line, index) => [line.id, rows[index] ?? []])),
        );
      }
    })().catch(() => {
      if (!stale) setTokens(new Map());
    });
    return () => {
      stale = true;
    };
  }, [lines, filename, theme]);
  return tokens;
}
