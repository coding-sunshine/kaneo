import { Paperclip } from "lucide-react-native";
import { useTranslation } from "react-i18next";
import { View } from "react-native";

import { Avatar } from "@/components/avatar";
import { MarkdownText } from "@/components/markdown";
import { Txt } from "@/components/text";
import type { ChatMessage } from "@/lib/api/types";
import { relativeShort } from "@/lib/format";
import { inset, useColors } from "@/theme";

export function MessageRow({
  message,
  showAuthor,
}: {
  message: ChatMessage;
  showAuthor: boolean;
}) {
  const { t } = useTranslation(["mobile"]);
  const c = useColors();
  const author = message.authorName ?? t("mobile:chat.unknownAuthor");
  return (
    <View
      style={{
        flexDirection: "row",
        gap: 10,
        paddingHorizontal: inset,
        paddingTop: showAuthor ? 12 : 2,
      }}
    >
      <View style={{ width: 28 }}>
        {showAuthor ? (
          <Avatar name={author} image={message.authorImage} size={28} />
        ) : null}
      </View>
      <View style={{ flex: 1, gap: 2 }}>
        {showAuthor ? (
          <View
            style={{ flexDirection: "row", alignItems: "baseline", gap: 8 }}
          >
            <Txt variant="bodySm" weight="semibold" numberOfLines={1}>
              {author}
            </Txt>
            <Txt variant="caption" tone="faint">
              {relativeShort(message.createdAt)}
            </Txt>
          </View>
        ) : null}
        {message.body ? (
          <MarkdownText size={14}>{message.body}</MarkdownText>
        ) : null}
        {message.files.map((file) => (
          <View
            key={file.id}
            style={{ flexDirection: "row", alignItems: "center", gap: 6 }}
          >
            <Paperclip size={14} color={c.muted} strokeWidth={2} />
            <Txt variant="meta" tone="ink2" numberOfLines={1}>
              {file.filename}
            </Txt>
          </View>
        ))}
        {message.editedAt ? (
          <Txt variant="caption" tone="faint">
            {t("mobile:chat.edited")}
          </Txt>
        ) : null}
      </View>
    </View>
  );
}
