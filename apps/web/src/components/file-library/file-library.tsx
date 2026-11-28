import { Search } from "lucide-react";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { FileLibraryRow } from "@/components/file-library/file-library-row";
import { Input } from "@/components/ui/input";
import { useFiles } from "@/hooks/queries/file-library/use-files";
import { useDebouncedValue } from "@/hooks/use-debounced-value";

/** Every file the viewer can open in the workspace, newest first. */
export function FileLibrary({ workspaceId }: { workspaceId: string }) {
  const { t } = useTranslation();
  const [search, setSearch] = useState("");
  const query = useDebouncedValue(search.trim(), 250) || undefined;
  const { data: files = [], isLoading, isError } = useFiles(workspaceId, query);

  const status = isError
    ? t("navigation:files.loadFailed")
    : isLoading
      ? t("navigation:files.loading")
      : files.length === 0
        ? query
          ? t("navigation:files.noMatches", { query })
          : t("navigation:files.empty")
        : null;

  return (
    <div className="flex flex-col">
      <div className="flex items-center gap-2 border-border/60 border-b px-4 py-2">
        <Search
          aria-hidden="true"
          className="size-4 shrink-0 text-muted-foreground"
        />
        <Input
          type="search"
          unstyled
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          placeholder={t("navigation:files.searchPlaceholder")}
          aria-label={t("navigation:files.search")}
          className="flex-1 text-sm"
        />
      </div>
      {status ? (
        <p
          role={isError ? "alert" : "status"}
          className="py-16 text-center text-sm text-muted-foreground"
        >
          {status}
        </p>
      ) : (
        <ul aria-label={t("navigation:files.title")} className="flex flex-col">
          {files.map((file) => (
            <FileLibraryRow
              key={file.id}
              workspaceId={workspaceId}
              file={file}
            />
          ))}
        </ul>
      )}
    </div>
  );
}
