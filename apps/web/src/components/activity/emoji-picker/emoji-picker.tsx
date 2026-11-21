import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import useWorkspaceEmoji from "@/hooks/queries/emoji/use-workspace-emoji";
import { useAuth } from "@/components/providers/auth-provider/hooks/use-auth";
import { customEmojiName, searchCustomEmoji } from "./custom-emoji";
import {
  loadFrequencies,
  recordEmojiUse,
  saveFrequencies,
  topEmoji,
} from "./emoji-frequency";
import {
  type EmojiEntry,
  type EmojiGroup,
  loadEmojiGroups,
  searchEmoji,
} from "./emoji-groups";

type EmojiPickerProps = {
  onSelect: (emoji: string) => void;
  /** Shown as a footer button; omit for members who cannot add emoji. */
  onAddEmoji?: () => void;
};

type GridEmoji = Pick<EmojiEntry, "emoji"> &
  Partial<EmojiEntry> & { url?: string };

function EmojiGrid({
  emojis,
  onSelect,
}: {
  emojis: GridEmoji[];
  onSelect: (emoji: string) => void;
}) {
  return (
    <div className="grid grid-cols-9">
      {emojis.map(({ emoji, name, url }) => (
        <button
          key={emoji}
          type="button"
          title={name}
          aria-label={name ?? emoji}
          onClick={() => onSelect(emoji)}
          className="flex size-7 items-center justify-center rounded-md text-lg leading-none outline-none hover:bg-accent focus-visible:bg-accent"
        >
          {url ? (
            <img src={url} alt={emoji} className="size-5 object-contain" />
          ) : (
            emoji
          )}
        </button>
      ))}
    </div>
  );
}

export default function EmojiPicker({
  onSelect: onPick,
  onAddEmoji,
}: EmojiPickerProps) {
  const { t } = useTranslation();
  const { user } = useAuth();
  const userId = user?.id ?? "anonymous";
  const [frequent] = useState(() => topEmoji(loadFrequencies(userId)));
  const onSelect = (emoji: string) => {
    saveFrequencies(userId, recordEmojiUse(loadFrequencies(userId), emoji));
    onPick(emoji);
  };
  const { data: customEmoji = [] } = useWorkspaceEmoji();
  const custom: GridEmoji[] = customEmoji.map(({ name, url }) => ({
    emoji: `:${name}:`,
    name,
    url,
  }));
  const [query, setQuery] = useState("");
  const [groups, setGroups] = useState<EmojiGroup[]>([]);

  useEffect(() => {
    let active = true;
    void loadEmojiGroups().then((loaded) => {
      if (active) setGroups(loaded);
    });
    return () => {
      active = false;
    };
  }, []);

  const results: GridEmoji[] | null = query.trim()
    ? [
        ...searchEmoji(groups, query),
        ...searchCustomEmoji(customEmoji, query).map(({ name, url }) => ({
          emoji: `:${name}:`,
          name,
          url,
        })),
      ]
    : null;

  return (
    <div className="flex w-68 flex-col">
      <input
        // biome-ignore lint/a11y/noAutofocus: the picker opens to type into
        autoFocus
        value={query}
        onChange={(event) => setQuery(event.target.value)}
        onKeyDown={(event) => {
          if (event.key === "Enter" && results?.[0]) {
            event.preventDefault();
            onSelect(results[0].emoji);
          }
        }}
        placeholder={t("activity:reactions.search")}
        aria-label={t("activity:reactions.search")}
        className="h-9 border-border border-b bg-transparent px-3 text-[13px] outline-none placeholder:text-muted-foreground"
      />
      <div className="max-h-72 overflow-y-auto px-2 pt-1.5 pb-2">
        {results ? (
          results.length > 0 ? (
            <EmojiGrid emojis={results} onSelect={onSelect} />
          ) : (
            <p className="px-1 py-6 text-center text-muted-foreground text-xs">
              {t("activity:reactions.noResults")}
            </p>
          )
        ) : (
          <>
            <p className="px-1 pt-1 pb-1 text-muted-foreground text-xs">
              {t("activity:reactions.frequentlyUsed")}
            </p>
            <EmojiGrid
              emojis={frequent.flatMap((emoji) => {
                const name = customEmojiName(emoji);
                if (!name) return [{ emoji }];
                const entry = custom.find((item) => item.name === name);
                return entry ? [entry] : [];
              })}
              onSelect={onSelect}
            />
            {groups.map((group) => (
              <section key={group.slug}>
                <p className="px-1 pt-2.5 pb-1 text-muted-foreground text-xs">
                  {t(`activity:reactions.groups.${group.slug}`)}
                </p>
                <EmojiGrid emojis={group.emojis} onSelect={onSelect} />
              </section>
            ))}
            {custom.length > 0 && (
              <section>
                <p className="px-1 pt-2.5 pb-1 text-muted-foreground text-xs">
                  {t("activity:reactions.groups.custom")}
                </p>
                <EmojiGrid emojis={custom} onSelect={onSelect} />
              </section>
            )}
          </>
        )}
      </div>
      {onAddEmoji && (
        <button
          type="button"
          onClick={onAddEmoji}
          className="h-9 border-border border-t px-3 text-left text-[13px] outline-none hover:bg-accent focus-visible:bg-accent"
        >
          {t("activity:reactions.addEmoji")}
        </button>
      )}
    </div>
  );
}
