import { router } from "expo-router";
import { FileText } from "lucide-react-native";
import { useTranslation } from "react-i18next";
import { View } from "react-native";

import { Txt } from "@/components/text";
import { Touch } from "@/components/ui";
import type { DocumentTreePage } from "@/lib/api/types";
import { inset, useColors } from "@/theme";

/** One page in the tree, indented by its depth. */
export function PageRow({
  page,
  workspaceId,
  depth = 0,
  first,
}: {
  page: DocumentTreePage;
  workspaceId: string;
  depth?: number;
  first: boolean;
}) {
  const { t } = useTranslation(["mobile"]);
  const c = useColors();
  return (
    <Touch
      onPress={() =>
        router.push({
          pathname: "/document/[documentId]",
          params: { documentId: page.id, workspaceId },
        })
      }
      style={{
        flexDirection: "row",
        alignItems: "center",
        gap: 10,
        minHeight: 48,
        paddingLeft: inset + depth * 18,
        paddingRight: inset,
        borderTopWidth: first ? 0 : 1,
        borderTopColor: c.divider,
      }}
    >
      <View style={{ width: 20, alignItems: "center" }}>
        {page.icon ? (
          <Txt variant="body">{page.icon}</Txt>
        ) : (
          <FileText size={16} color={c.muted} strokeWidth={2} />
        )}
      </View>
      <Txt variant="body" numberOfLines={1} style={{ flex: 1 }}>
        {page.title || t("mobile:documents.untitled")}
      </Txt>
    </Touch>
  );
}
