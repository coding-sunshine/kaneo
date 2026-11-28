import { ArrowUp } from "lucide-react-native";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { ActivityIndicator, TextInput, View } from "react-native";

import { useBottomInset } from "@/components/screen";
import { Touch } from "@/components/ui";
import { font, inset, useColors } from "@/theme";

/** Message input docked above the keyboard. Resolves true once the message is sent. */
export function ChatComposer({
  placeholder,
  onSend,
}: {
  placeholder: string;
  onSend: (body: string) => Promise<boolean>;
}) {
  const { t } = useTranslation(["mobile"]);
  const c = useColors();
  const bottom = useBottomInset(6);
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const ready = !!text.trim() && !busy;

  const send = async () => {
    if (!ready) return;
    setBusy(true);
    try {
      if (await onSend(text.trim())) setText("");
    } finally {
      setBusy(false);
    }
  };

  return (
    <View
      style={{
        flexDirection: "row",
        alignItems: "flex-end",
        gap: 8,
        paddingHorizontal: inset,
        paddingTop: 10,
        paddingBottom: bottom,
        backgroundColor: c.surface,
        borderTopWidth: 1,
        borderTopColor: c.hairline,
      }}
    >
      <TextInput
        value={text}
        onChangeText={setText}
        placeholder={placeholder}
        placeholderTextColor={c.faint}
        selectionColor={c.ink}
        multiline
        accessibilityLabel={placeholder}
        style={{
          flex: 1,
          minHeight: 44,
          maxHeight: 140,
          paddingHorizontal: 14,
          paddingVertical: 12,
          borderRadius: 12,
          backgroundColor: c.input,
          color: c.ink,
          fontFamily: font.regular,
          fontSize: 14,
          lineHeight: 19,
        }}
      />
      <Touch
        onPress={send}
        disabled={!ready}
        accessibilityLabel={t("mobile:chat.send")}
        style={{
          width: 44,
          height: 44,
          borderRadius: 12,
          alignItems: "center",
          justifyContent: "center",
          backgroundColor: text.trim() ? c.primary : c.fill,
        }}
      >
        {busy ? (
          <ActivityIndicator size="small" color={c.onPrimary} />
        ) : (
          <ArrowUp
            size={18}
            color={text.trim() ? c.onPrimary : c.placeholder}
            strokeWidth={2}
          />
        )}
      </Touch>
    </View>
  );
}
