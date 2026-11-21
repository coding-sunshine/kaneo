import useWorkspaceEmoji from "@/hooks/queries/emoji/use-workspace-emoji";
import { customEmojiName } from "./custom-emoji";

/** A native emoji as text, or a custom `:name:` as its image (text if deleted). */
export default function EmojiGlyph({ emoji }: { emoji: string }) {
  const name = customEmojiName(emoji);
  const { data } = useWorkspaceEmoji();
  const url = name ? data?.find((item) => item.name === name)?.url : undefined;
  if (!url) return <>{emoji}</>;
  return (
    <img
      src={url}
      alt={emoji}
      title={emoji}
      className="size-[1em] object-contain"
    />
  );
}
