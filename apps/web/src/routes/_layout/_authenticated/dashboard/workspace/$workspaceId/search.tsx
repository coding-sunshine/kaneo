import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowLeft, Loader2, Search } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import WorkspaceLayout from "@/components/common/workspace-layout";
import PageTitle from "@/components/page-title";
import { SemanticAnswer } from "@/components/search-page/semantic/semantic-answer";
import { groupSearchResults } from "@/components/search-page/group-search-results";
import { SearchResultGroup } from "@/components/search-page/search-result-group";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import useGlobalSearch from "@/hooks/queries/search/use-global-search";
import { useOpenSearchResult } from "@/hooks/use-open-search-result";

export const Route = createFileRoute(
  "/_layout/_authenticated/dashboard/workspace/$workspaceId/search",
)({
  component: SearchComponent,
});

function SearchComponent() {
  const { t } = useTranslation();
  const { workspaceId } = Route.useParams();
  const openResult = useOpenSearchResult(workspaceId);
  const [searchInput, setSearchInput] = useState("");
  const [debouncedQuery, setDebouncedQuery] = useState("");
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const { data, isLoading, isFetching } = useGlobalSearch({
    q: debouncedQuery,
    workspaceId,
    type: "all",
    limit: 50,
  });

  const handleInputChange = useCallback((value: string) => {
    setSearchInput(value);

    if (debounceRef.current) {
      clearTimeout(debounceRef.current);
    }

    debounceRef.current = setTimeout(() => {
      setDebouncedQuery(value.trim());
    }, 300);
  }, []);

  useEffect(() => {
    return () => {
      if (debounceRef.current) {
        clearTimeout(debounceRef.current);
      }
    };
  }, []);

  const results = data?.results ?? [];
  const groups = groupSearchResults(results);
  const hasQuery = debouncedQuery.length > 0;
  const showLoading = hasQuery && (isLoading || isFetching);

  const quickSearchSuggestions = useMemo(
    () => [
      t("workspace:search.suggestionHighPriority"),
      t("workspace:search.suggestionBug"),
      t("workspace:search.suggestionFeature"),
      t("workspace:search.suggestionInProgress"),
      t("workspace:search.suggestionCompleted"),
    ],
    [t],
  );

  return (
    <>
      <PageTitle title={t("workspace:search.pageTitle")} />
      <WorkspaceLayout
        title={t("workspace:search.pageTitle")}
        headerActions={
          <Link
            to="/dashboard/workspace/$workspaceId"
            params={{ workspaceId }}
            aria-label={t("workspace:search.backToDashboard")}
          >
            <Button variant="ghost" size="sm" className="gap-2" tabIndex={-1}>
              <ArrowLeft className="w-4 h-4" />
              <span className="hidden sm:inline">
                {t("workspace:search.backToDashboard")}
              </span>
            </Button>
          </Link>
        }
      >
        <div className="mx-auto w-full max-w-3xl space-y-6 p-4 sm:p-6">
          <div>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground w-4 h-4" />
              <Input
                placeholder={t("workspace:search.placeholder")}
                value={searchInput}
                onChange={(e) => handleInputChange(e.target.value)}
                className="h-12 text-base sm:text-lg [&_[data-slot=input]]:pl-10"
                autoFocus
              />
              {showLoading && (
                <Loader2 className="absolute right-3 top-1/2 transform -translate-y-1/2 w-4 h-4 animate-spin text-muted-foreground" />
              )}
            </div>
            <p className="text-sm text-muted-foreground mt-2">
              {t("workspace:search.hint")}
            </p>
          </div>

          {hasQuery && (
            <SemanticAnswer
              key={debouncedQuery}
              workspaceId={workspaceId}
              query={debouncedQuery}
            />
          )}

          {hasQuery ? (
            <div>
              {showLoading && results.length === 0 ? (
                <div className="flex items-center justify-center py-12">
                  <div className="text-center space-y-4">
                    <Loader2 className="w-8 h-8 animate-spin text-muted-foreground mx-auto" />
                    <p className="text-sm text-muted-foreground">
                      {t("workspace:search.searching")}
                    </p>
                  </div>
                </div>
              ) : results.length > 0 ? (
                <div className="space-y-6">
                  <p className="text-xs text-muted-foreground">
                    {t("workspace:search.resultsFound", {
                      count: data?.totalCount ?? results.length,
                    })}
                  </p>
                  {groups.map((group) => (
                    <SearchResultGroup
                      key={group.type}
                      type={group.type}
                      items={group.items}
                      onOpen={openResult}
                    />
                  ))}
                </div>
              ) : (
                <div className="text-center py-12">
                  <Search className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
                  <p className="text-lg font-medium mb-2">
                    {t("workspace:search.noResultsTitle")}
                  </p>
                  <p className="text-muted-foreground">
                    {t("workspace:search.noResultsDescription")}
                  </p>
                </div>
              )}
            </div>
          ) : (
            <div className="text-center py-12">
              <Search className="w-16 h-16 text-muted-foreground mx-auto mb-4" />
              <h2 className="text-xl font-semibold mb-2">
                {t("workspace:search.startTitle")}
              </h2>
              <p className="text-muted-foreground mb-6">
                {t("workspace:search.startDescription")}
              </p>

              <div className="space-y-2">
                <p className="text-sm font-medium text-muted-foreground">
                  {t("workspace:search.quickSearchesLabel")}
                </p>
                <div className="flex flex-wrap gap-2 justify-center">
                  {quickSearchSuggestions.map((suggestion) => (
                    <Button
                      key={suggestion}
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        setSearchInput(suggestion);
                        setDebouncedQuery(suggestion);
                      }}
                      className="text-xs"
                    >
                      {suggestion}
                    </Button>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>
      </WorkspaceLayout>
    </>
  );
}
