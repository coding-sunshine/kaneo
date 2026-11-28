import { useQuery } from "@tanstack/react-query";
import { router, useLocalSearchParams } from "expo-router";
import { ChevronRight } from "lucide-react-native";
import { useTranslation } from "react-i18next";
import { View } from "react-native";

import { MarkdownText } from "@/components/markdown";
import {
  ErrorState,
  Loading,
  Screen,
  Scroll,
  TopBar,
} from "@/components/screen";
import { Txt } from "@/components/text";
import { Touch } from "@/components/ui";
import { PageRow } from "@/features/documents/page-row";
import { childPages } from "@/features/documents/page-tree";
import { usePageTree } from "@/features/documents/use-page-tree";
import { userMessage } from "@/lib/api/client";
import { api } from "@/lib/api/endpoints";
import { relativeShort } from "@/lib/format";
import { qk } from "@/lib/query";
import { inset, useColors } from "@/theme";

export default function DocumentScreen() {
  const { t } = useTranslation(["mobile"]);
  const c = useColors();
  const { documentId, workspaceId } = useLocalSearchParams<{
    documentId: string;
    workspaceId: string;
  }>();
  const doc = useQuery({
    queryKey: qk.document(documentId),
    queryFn: () => api.document(workspaceId, documentId),
  });
  const tree = usePageTree(workspaceId);
  const children = childPages(tree.data ?? [], documentId);
  const d = doc.data;
  const open = (id: string) =>
    router.push({
      pathname: "/document/[documentId]",
      params: { documentId: id, workspaceId },
    });

  return (
    <Screen surface>
      <TopBar />
      {doc.isLoading ? (
        <Loading />
      ) : doc.error || !d ? (
        <ErrorState
          message={userMessage(doc.error)}
          onRetry={() => void doc.refetch()}
        />
      ) : (
        <Scroll
          refreshing={doc.isRefetching}
          onRefresh={() => {
            void doc.refetch();
            void tree.refetch();
          }}
        >
          <View style={{ paddingHorizontal: inset, paddingTop: 12, gap: 8 }}>
            {d.ancestors.length ? (
              <View
                accessibilityRole="header"
                style={{
                  flexDirection: "row",
                  flexWrap: "wrap",
                  alignItems: "center",
                  gap: 4,
                }}
              >
                {d.ancestors.map((a) => (
                  <View
                    key={a.id}
                    style={{
                      flexDirection: "row",
                      alignItems: "center",
                      gap: 4,
                    }}
                  >
                    <Touch onPress={() => open(a.id)} accessibilityRole="link">
                      <Txt variant="meta" tone="muted" numberOfLines={1}>
                        {a.title || t("mobile:documents.untitled")}
                      </Txt>
                    </Touch>
                    <ChevronRight size={12} color={c.placeholder} />
                  </View>
                ))}
              </View>
            ) : null}
            <Txt variant="title">
              {d.icon ? `${d.icon} ` : ""}
              {d.title || t("mobile:documents.untitled")}
            </Txt>
            <Txt variant="caption" tone="faint">
              {d.updatedByName
                ? t("mobile:documents.editedBy", {
                    when: relativeShort(d.updatedAt),
                    name: d.updatedByName,
                  })
                : t("mobile:documents.edited", {
                    when: relativeShort(d.updatedAt),
                  })}
            </Txt>
            <MarkdownText>{d.content}</MarkdownText>
          </View>
          {children.length ? (
            <View style={{ paddingTop: 20 }}>
              <Txt
                variant="caption"
                weight="medium"
                tone="muted"
                style={{ paddingHorizontal: inset, paddingBottom: 6 }}
              >
                {t("mobile:documents.subpages")}
              </Txt>
              {children.map((page, i) => (
                <PageRow
                  key={page.id}
                  page={page}
                  workspaceId={workspaceId}
                  first={i === 0}
                />
              ))}
            </View>
          ) : null}
        </Scroll>
      )}
    </Screen>
  );
}
