import { useMutation } from "@tanstack/react-query";
import { Sparkles } from "lucide-react";
import { useTranslation } from "react-i18next";
import { CatchUpSourceChip } from "@/components/home/catch-up/catch-up-source-chip";
import { Button } from "@/components/ui/button";
import { semanticSearch } from "@/fetchers/semantic-search/semantic-search";
import { HttpError } from "@/lib/http-error";

/** Asks the question by meaning, with an answer that cites what it read. */
export function SemanticAnswer({
  workspaceId,
  query,
}: {
  workspaceId: string;
  query: string;
}) {
  const { t } = useTranslation();
  const ask = useMutation({
    mutationFn: () => semanticSearch(workspaceId, query),
  });
  const off = ask.error instanceof HttpError && ask.error.status === 404;

  return (
    <section
      aria-label={t("workspace:search.semantic.title")}
      className="flex flex-col gap-3 rounded-md border border-border/70 bg-muted/20 p-3 text-sm"
    >
      <Button
        size="sm"
        variant="outline"
        className="self-start"
        disabled={query.trim().length < 3 || ask.isPending}
        onClick={() => ask.mutate()}
      >
        <Sparkles />
        {ask.isPending
          ? t("workspace:search.semantic.running")
          : t("workspace:search.semantic.ask")}
      </Button>
      {off ? (
        <p role="status" className="text-muted-foreground">
          {t("workspace:search.semantic.off")}
        </p>
      ) : ask.isError ? (
        <p role="alert" className="text-destructive">
          {ask.error.message}
        </p>
      ) : null}
      {ask.data && (
        <>
          <p className="whitespace-pre-wrap">
            {ask.data.answer ?? t("workspace:search.semantic.noAnswer")}
          </p>
          {ask.data.sources.length > 0 && (
            <span className="flex flex-wrap gap-1.5">
              {ask.data.sources.map((source, index) => (
                <CatchUpSourceChip
                  key={
                    source.restricted
                      ? `r-${index}`
                      : `${source.kind}-${source.id}`
                  }
                  workspaceId={workspaceId}
                  source={source}
                />
              ))}
            </span>
          )}
          {ask.data.results.length > 0 && (
            <ul
              aria-label={t("workspace:search.semantic.matches")}
              className="flex flex-col gap-1.5"
            >
              {ask.data.results.map((result) => (
                <li key={result.id} className="flex items-start gap-2">
                  <CatchUpSourceChip
                    workspaceId={workspaceId}
                    source={result.citation}
                  />
                  <span className="min-w-0 flex-1 truncate text-muted-foreground">
                    {result.snippet}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </>
      )}
    </section>
  );
}
