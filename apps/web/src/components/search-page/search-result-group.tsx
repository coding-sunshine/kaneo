import { useTranslation } from "react-i18next";
import { SearchResultRow } from "@/components/search-page/search-result-row";
import type { SearchResult } from "@/components/search-page/types";

/** One type's results under its heading on the search page. */
export function SearchResultGroup({
  type,
  items,
  onOpen,
}: {
  type: string;
  items: SearchResult[];
  onOpen: (result: SearchResult) => void;
}) {
  const { t } = useTranslation();
  const headingId = `search-group-${type}`;
  const label = (() => {
    switch (type) {
      case "message":
        return t("navigation:search.groups.message");
      case "task":
        return t("navigation:search.groups.task");
      case "document":
        return t("navigation:search.groups.document");
      case "project":
        return t("navigation:search.groups.project");
      case "person":
        return t("navigation:search.groups.person");
      case "comment":
        return t("navigation:search.groups.comment");
      case "activity":
        return t("navigation:search.groups.activity");
      case "workspace":
        return t("navigation:search.groups.workspace");
      default:
        return t("navigation:search.groups.fallback");
    }
  })();

  return (
    <section aria-labelledby={headingId} className="space-y-1">
      <h2
        id={headingId}
        className="px-1 pb-1 text-xs font-medium uppercase tracking-wide text-muted-foreground"
      >
        {label}
      </h2>
      {items.map((result) => (
        <SearchResultRow
          key={`${result.type}-${result.id}`}
          result={result}
          onOpen={onOpen}
        />
      ))}
    </section>
  );
}
