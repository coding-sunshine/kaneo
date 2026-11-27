import type globalSearch from "@/fetchers/search/global-search";

export type SearchResult = Awaited<
  ReturnType<typeof globalSearch>
>["results"][number];
