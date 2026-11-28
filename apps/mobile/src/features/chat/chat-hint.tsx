import { View } from "react-native";

import { Txt } from "@/components/text";
import { inset, useColors } from "@/theme";

/** Takes the composer's place when you cannot post. */
export function ChatHint({ text }: { text: string }) {
  const c = useColors();
  return (
    <View
      style={{ padding: inset, borderTopWidth: 1, borderTopColor: c.hairline }}
    >
      <Txt variant="meta" tone="muted" center>
        {text}
      </Txt>
    </View>
  );
}
