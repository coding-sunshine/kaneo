import { useTranslation } from "react-i18next";
import { View } from "react-native";

import { EmptyState, ErrorState, Loading, Scroll } from "@/components/screen";
import { Txt } from "@/components/text";
import { userMessage } from "@/lib/api/client";
import { inset, useColors } from "@/theme";

import { PageRow } from "./page-row";
import { flattenPageTree } from "./page-tree";
import { usePageTree } from "./use-page-tree";

/** Every page you can open, nested as in the web sidebar. */
export function DocumentsTab({ workspaceId }: { workspaceId: string }) {
  const { t } = useTranslation(["mobile"]);
  const c = useColors();
  const tree = usePageTree(workspaceId);
  const rows = flattenPageTree(tree.data ?? []);
  return (
    <View style={{ flex: 1, backgroundColor: c.surface }}>
      <View
        style={{ height: 52, justifyContent: "center", paddingLeft: inset }}
      >
        <Txt variant="title">{t("mobile:documents.title")}</Txt>
      </View>
      {tree.isLoading ? (
        <Loading />
      ) : tree.error ? (
        <ErrorState
          message={userMessage(tree.error)}
          onRetry={() => void tree.refetch()}
        />
      ) : rows.length === 0 ? (
        <EmptyState
          title={t("mobile:documents.empty.title")}
          message={t("mobile:documents.empty.message")}
        />
      ) : (
        <Scroll
          refreshing={tree.isRefetching}
          onRefresh={() => void tree.refetch()}
        >
          {rows.map((row, i) => (
            <PageRow
              key={row.page.id}
              page={row.page}
              depth={row.depth}
              workspaceId={workspaceId}
              first={i === 0}
            />
          ))}
        </Scroll>
      )}
    </View>
  );
}
